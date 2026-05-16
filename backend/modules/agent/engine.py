"""
engine.py — DriveLegal Agent Engine

Architecture (Agentic Loop):
───────────────────────────────────────────────────────────────
User message
    │
    ▼
LLM (Ollama local / Gemini cloud) with tools + system prompt
    │
    ├── Decides to call: lookup_fine("no helmet", "2W", "Tamil Nadu")
    │       └── ToolExecutor._lookup_fine() → queries SQLite
    │               └── returns { amount_inr: 1000, section: "129" }
    │
    ├── Decides to call: lookup_rule("NO_HELMET", "Tamil Nadu")
    │       └── ToolExecutor._lookup_rule() → queries rules.json
    │               └── returns { title:..., description:... }
    │
    └── Synthesizes tool results → writes natural language response
            └── "The fine for not wearing a helmet in Tamil Nadu is ₹1,000
                 under Section 194D of the Motor Vehicles Act 1988..."
    │
    ▼
Final structured response returned to mobile app
───────────────────────────────────────────────────────────────

Priority: Ollama (local) → Gemini (cloud) → Keyword fallback

SDK:
  - Ollama: openai Python SDK pointed at http://localhost:11434/v1
  - Gemini: google-genai SDK (legacy fallback)
"""

import os
import json
import re
import logging
from typing import Any, Dict, List, Optional

from backend.modules.agent.tools import ToolExecutor

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# System Prompt
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are DriveLegal AI — an official Indian traffic law assistant powered by AI.

You help drivers, citizens, and legal professionals with:
- Traffic violation fines and challan amounts (Motor Vehicles Act 1988)
- Traffic laws, rules, and which MV Act sections apply
- Location-based zone restrictions (school zones, no-horn zones, speed limits)
- Repeat offence implications and higher penalties

STRICT GUIDELINES:
1. For greetings (hi, hello) or questions about yourself/the AI model: reply in plain text only — do NOT call any tools.
2. For traffic fines, laws, or rules: you MUST use the provided tools. NEVER guess amounts or sections.
3. Only call check_zone when the user asks about their location, nearby restrictions, school zones, no-horn zones, or speed limits at a place. Never call check_zone for greetings or unrelated questions.
4. Always cite the MV Act section number when mentioning a rule from tools.
5. Use ₹ symbol for Indian Rupee amounts.
6. CRITICAL: If a tool returns "found": false, you MUST state that you do not have the information in your database. Do NOT use your pre-trained knowledge to answer. NEVER fabricate or guess fine amounts.
7. For repeat offences, always mention the higher penalty.
8. Be concise, clear, and structured. Use bullet points for multiple items.
9. For traffic-law answers only, end with: "⚠️ This is informational only. Consult official sources or a legal professional for official advice."
10. Infer the vehicle type from context (e.g., "bike" = 2W, "car" = LMV).
11. Use the conversation history for follow-ups (e.g. "5th time", "what about repeat", "same offence") — keep the same violation, vehicle, and state from earlier turns.

TONE: Professional, helpful, government-branded. Not casual."""


# ─────────────────────────────────────────────────────────────────────────────
# Agent Engine
# ─────────────────────────────────────────────────────────────────────────────

class AgentEngine:
    """
    Main AI agent with priority: Ollama (local) → Gemini (cloud) → Keyword fallback.

    Ollama integration uses the OpenAI-compatible API served at /v1/.
    Gemini integration uses the google-genai SDK (kept as cloud fallback).
    """

    MAX_TOOL_ITERATIONS = 5

    def __init__(self, fine_lookup, rules_loader, geofencing_engine):
        self.tool_executor = ToolExecutor(fine_lookup, rules_loader, geofencing_engine)
        self.hybrid_search = None

        # Provider flags
        self.ollama_available = False
        self.gemini_available = False
        self.ollama_model = None
        self.ollama_client = None
        self.gemini_client = None

        # ── Local NLP (HybridSearch) for offline fallback ──────────────────
        try:
            from backend.modules.nlp.hybrid_search import HybridSearch
            rules_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "rules.json")
            persist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "vector_db")
            self.hybrid_search = HybridSearch(rules_path, persist_dir)
            logger.info("[Agent] Local NLP (HybridSearch) loaded with %d documents.", len(self.hybrid_search.documents))
        except Exception as e:
            logger.warning("[Agent] HybridSearch unavailable (%s). Keyword-only fallback.", e)

        # ── 1. Try Ollama (local, primary) ─────────────────────────────────
        self._init_ollama()

        # ── 2. Try Gemini (cloud, fallback) ────────────────────────────────
        if not self.ollama_available:
            self._init_gemini()

    def _init_ollama(self):
        """Initialize Ollama via OpenAI-compatible API."""
        ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")

        try:
            from openai import OpenAI
            client = OpenAI(base_url=ollama_base_url, api_key="ollama")
            # Quick connectivity check — list models
            client.models.list()
            self.ollama_client = client
            self.ollama_model = ollama_model
            self.ollama_available = True
            logger.info("[Agent] ✅ Ollama ready — model: %s at %s", ollama_model, ollama_base_url)
        except Exception as e:
            logger.warning("[Agent] Ollama not available (%s). Trying Gemini...", e)

    def _init_gemini(self):
        """Initialize Gemini (cloud fallback)."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            logger.warning("[Agent] GEMINI_API_KEY not set. Running in keyword-fallback mode.")
            return

        try:
            from google import genai
            from google.genai import types
            self.gemini_client = genai.Client(api_key=api_key)
            self.gemini_types = types
            self.gemini_available = True
            logger.info("[Agent] Gemini 2.0 Flash ready (cloud fallback).")
        except Exception as e:
            logger.error(f"[Agent] Failed to initialize Gemini: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def run(
        self,
        user_text: str,
        conversation_history: Optional[List[Dict]] = None,
        gps: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        clean_text = self._clean_user_text(user_text)
        conversational = (
            self._try_conversational_response(clean_text)
            or self._try_conversational_response(user_text)
        )
        if conversational:
            return conversational

        history = conversation_history or []

        if self.ollama_available:
            return self._run_ollama(user_text, history, gps)
        if self.gemini_available:
            return self._run_gemini(user_text, history, gps)
        return self._keyword_fallback(user_text, gps)

    def _active_model_label(self) -> str:
        if self.ollama_available:
            return f"ollama/{self.ollama_model}"
        if self.gemini_available:
            return "gemini-2.0-flash"
        return "keyword-fallback"

    def _clean_user_text(self, text: str) -> str:
        t = (text or "").strip().lower()
        t = re.sub(r"[!?.。,;:]+$", "", t)
        t = re.sub(r"\s+", " ", t)
        return t

    def _message_needs_location(self, text: str) -> bool:
        text_lower = self._clean_user_text(text)
        location_keywords = (
            "zone", "here", "location", "nearby", "near me", "this area",
            "my area", "where i am", "school zone", "no-horn", "no horn",
            "speed limit", "gps", "coordinates",
        )
        return any(k in text_lower for k in location_keywords)

    def _history_transcript(self, history: List[Dict], max_turns: int = 6) -> str:
        lines = []
        for turn in history[-max_turns:]:
            role = "User" if turn.get("role") == "user" else "Assistant"
            parts = turn.get("parts", [""])
            content = (parts[0] if parts else "").strip()
            if content:
                lines.append(f"{role}: {content[:600]}")
        return "\n".join(lines)

    def _history_has_traffic_context(self, history: List[Dict]) -> bool:
        blob = self._history_transcript(history, max_turns=10).lower()
        hints = (
            "fine", "penalty", "challan", "helmet", "speed", "offence", "offense",
            "violation", "₹", "rupee", "section", "motor vehicle", "mv act", "license",
        )
        return any(h in blob for h in hints)

    def _is_follow_up_question(self, text: str, history: List[Dict]) -> bool:
        if len(history) < 2:
            return False
        clean = self._clean_user_text(text)
        follow_up_keywords = (
            "5th", "5 time", "5th time", "fifth", "fourth", "4th", "third", "3rd",
            "second", "2nd", "repeat", "again", "same", "that", "this", "it",
            "what about", "how about", "and if", "what if", "the fine", "my fine",
            "that offence", "that offense", "previous", "earlier",
        )
        if any(k in clean for k in follow_up_keywords):
            return True
        # Short vague message after a traffic discussion → treat as follow-up
        return len(clean.split()) <= 10 and self._history_has_traffic_context(history)

    def _is_traffic_query(self, text: str, history: Optional[List[Dict]] = None) -> bool:
        """True when the user message should use fines/rules/zone tools."""
        history = history or []
        clean = self._clean_user_text(text)
        if self._try_conversational_response(clean):
            return False
        if history and self._is_follow_up_question(text, history):
            return True
        traffic_keywords = (
            "fine", "penalty", "challan", "amount", "how much", "rupee", "₹",
            "helmet", "speed", "license", "licence", "insurance", "drunk",
            "rule", "law", "act", "section", "offence", "offense", "violation",
            "vehicle", "bike", "car", "truck", "red light", "seatbelt",
            "parking", "horn", "permit", "document", "mv act", "motor vehicle",
        )
        if any(k in clean for k in traffic_keywords):
            return True
        return self._message_needs_location(text)

    def _expand_follow_up_user_text(self, user_text: str, history: List[Dict]) -> str:
        if not self._is_follow_up_question(user_text, history):
            return user_text
        transcript = self._history_transcript(history)
        if not transcript:
            return user_text
        return (
            f"{user_text}\n\n"
            "[Follow-up — continue the same topic as this conversation. "
            "Reuse offence, vehicle type, and state from earlier messages. "
            "For repeat offences (2nd, 5th time, etc.) call lookup_fine with is_repeat=true.]\n"
            f"{transcript}"
        )

    def _try_conversational_response(self, user_text: str) -> Optional[Dict[str, Any]]:
        """Fast path for greetings and meta questions — no tools, no zone checks."""
        text_lower = self._clean_user_text(user_text)
        model_label = self._active_model_label()

        greetings = (
            "hi", "hello", "hey", "hii", "hola",
            "good morning", "good evening", "good afternoon", "namaste",
        )
        if (
            text_lower in greetings
            or text_lower.startswith(("hi ", "hello ", "hey "))
            or re.match(r"^(hi|hello|hey|hii|namaste)[\s!.]*$", text_lower)
        ):
            return {
                "status": "ok",
                "response": (
                    "Hello! 👋 I'm DriveLegal AI — your Indian traffic law assistant.\n\n"
                    "Ask me about fines, MV Act rules, challans, or zone restrictions. "
                    "For example: \"What's the fine for no helmet in Tamil Nadu?\"\n\n"
                    f"(Running on **{model_label}** locally.)"
                ),
                "tools_used": [],
                "agent_powered": self.ollama_available or self.gemini_available,
                "model": model_label,
            }

        meta_keywords = (
            "which model", "what model", "running on", "what ai", "who are you",
            "which llm", "what llm", "are you gemini", "are you ollama", "your model",
        )
        if any(k in text_lower for k in meta_keywords):
            backend = "local Ollama on your machine" if self.ollama_available else (
                "Google Gemini (cloud)" if self.gemini_available else "keyword search (no LLM)"
            )
            return {
                "status": "ok",
                "response": (
                    f"I'm **DriveLegal AI**, powered by **{model_label}** ({backend}).\n\n"
                    "I use tools to look up real fine amounts and traffic rules from the project database — "
                    "not guesses. Ask me any traffic-law question!"
                ),
                "tools_used": [],
                "agent_powered": self.ollama_available or self.gemini_available,
                "model": model_label,
            }

        return None

    def _enrich_with_gps(self, user_text: str, gps: Optional[Dict]) -> str:
        if not gps or not self._message_needs_location(user_text):
            return user_text
        return (
            f"{user_text}\n\n"
            f"[System context: User GPS lat={gps.get('lat')}, lon={gps.get('lon')}. "
            "Use check_zone only if this question is about location-based restrictions.]"
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Ollama Agentic Loop (OpenAI-compatible API)
    # ─────────────────────────────────────────────────────────────────────────

    def _run_ollama(self, user_text: str, history: List[Dict], gps: Optional[Dict]) -> Dict[str, Any]:
        tools_used = []

        expanded_text = self._expand_follow_up_user_text(user_text, history)
        enriched_text = self._enrich_with_gps(expanded_text, gps)
        use_tools = self._is_traffic_query(user_text, history) or self._is_traffic_query(expanded_text, history)
        openai_tools = self._build_openai_tools() if use_tools else None

        # Build messages list (OpenAI chat format)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for turn in history:
            role = turn.get("role", "user")
            # Map "model" role to "assistant" for OpenAI format
            if role == "model":
                role = "assistant"
            parts = turn.get("parts", [""])
            content = parts[0] if parts else ""
            messages.append({"role": role, "content": content})

        # Add current user message
        messages.append({"role": "user", "content": enriched_text})

        try:
            for iteration in range(self.MAX_TOOL_ITERATIONS):
                create_kwargs: Dict[str, Any] = {
                    "model": self.ollama_model,
                    "messages": messages,
                    "temperature": 0.1,
                }
                if openai_tools:
                    create_kwargs["tools"] = openai_tools
                response = self.ollama_client.chat.completions.create(**create_kwargs)

                choice = response.choices[0]
                assistant_message = choice.message

                # Check if model wants to call tools (proper protocol)
                tool_calls_list = assistant_message.tool_calls or []

                # Fallback: parse tool calls from text if model outputs JSON text
                text_parsed_calls = []
                if use_tools and not tool_calls_list and assistant_message.content:
                    text_parsed_calls = self._parse_tool_calls_from_text(
                        assistant_message.content
                    )

                if not tool_calls_list and not text_parsed_calls:
                    # No tool calls at all → final text answer
                    break

                # Process proper tool calls
                if tool_calls_list:
                    logger.info(
                        "[Agent/Ollama] Iteration %d: tools called: %s",
                        iteration + 1,
                        [tc.function.name for tc in tool_calls_list],
                    )

                    # Add the assistant's message (with tool calls) to conversation
                    messages.append(assistant_message.model_dump())

                    for tool_call in tool_calls_list:
                        func_name = tool_call.function.name
                        try:
                            params = json.loads(tool_call.function.arguments)
                        except json.JSONDecodeError:
                            params = {}

                        result = self.tool_executor.execute(func_name, params, gps)

                        tools_used.append({
                            "tool": func_name,
                            "params": params,
                            "result": result,
                        })

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(result),
                        })

                # Process text-parsed tool calls
                elif text_parsed_calls:
                    logger.info(
                        "[Agent/Ollama] Iteration %d: parsed tools from text: %s",
                        iteration + 1,
                        [tc["name"] for tc in text_parsed_calls],
                    )

                    # Add assistant text as a message
                    messages.append({"role": "assistant", "content": assistant_message.content})

                    # Execute parsed tools and collect results
                    tool_results_text = []
                    for tc in text_parsed_calls:
                        result = self.tool_executor.execute(tc["name"], tc["arguments"], gps)
                        tools_used.append({
                            "tool": tc["name"],
                            "params": tc["arguments"],
                            "result": result,
                        })
                        tool_results_text.append(
                            f"Tool '{tc['name']}' returned: {json.dumps(result)}"
                        )

                    # Feed results back as a user message so the model can synthesize
                    messages.append({
                        "role": "user",
                        "content": (
                            "Here are the tool results. Use them to answer the original question "
                            "in natural language. Do NOT output any JSON or tool calls.\n\n"
                            + "\n".join(tool_results_text)
                        ),
                    })

            # Extract final text
            final_text = (assistant_message.content or "").strip()

            # If the final response is just JSON (tool call output), do one more pass
            if final_text and self._looks_like_json_tool_call(final_text) and tools_used:
                # The model output a tool call as text — we already executed it above.
                # Do a final synthesis pass.
                messages.append({"role": "assistant", "content": final_text})
                tool_summary = "\n".join(
                    f"Tool '{t['tool']}' result: {json.dumps(t['result'])}" for t in tools_used
                )
                messages.append({
                    "role": "user",
                    "content": (
                        "Based on the above tool results, provide a helpful natural language answer "
                        "to the user's original question. Do NOT output JSON.\n\n"
                        + tool_summary
                    ),
                })
                response = self.ollama_client.chat.completions.create(
                    model=self.ollama_model,
                    messages=messages,
                    temperature=0.1,
                )
                final_text = (response.choices[0].message.content or "").strip()

            if not final_text:
                final_text = (
                    "I couldn't find specific information. "
                    "Please rephrase or consult official sources."
                )

            return {
                "status": "ok",
                "response": final_text,
                "tools_used": tools_used,
                "agent_powered": True,
                "model": f"ollama/{self.ollama_model}",
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[Agent/Ollama] Error: {error_msg}")

            # Try Gemini as fallback
            if self.gemini_available:
                logger.info("[Agent] Ollama failed. Falling back to Gemini.")
                return self._run_gemini(user_text, history, gps)

            fallback = self._keyword_fallback(user_text, gps)
            fallback["error_detail"] = error_msg
            return fallback

    def _build_openai_tools(self) -> list:
        """Convert TOOL_DEFINITIONS to OpenAI function-calling format."""
        openai_tools = []
        for tool in TOOL_DEFINITIONS_RAW:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["parameters"],
                },
            })
        return openai_tools

    def _parse_tool_calls_from_text(self, text: str) -> list:
        """
        Parse tool/function calls from model text output.
        Some models output JSON like {"name": "lookup_fine", "arguments": {...}}
        instead of using the proper tool_calls protocol.
        """
        valid_tool_names = {t["name"] for t in TOOL_DEFINITIONS_RAW}
        parsed = []

        # Try to find JSON objects in the text
        # Pattern 1: {"name": "tool_name", "arguments": {...}}
        try:
            data = json.loads(text.strip())
            if isinstance(data, dict) and data.get("name") in valid_tool_names:
                parsed.append({
                    "name": data["name"],
                    "arguments": data.get("arguments", data.get("params", {})),
                })
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

        # Pattern 2: Find JSON blocks in text (possibly wrapped in markdown code blocks)
        json_blocks = re.findall(r'```(?:json)?\s*({.*?})\s*```', text, re.DOTALL)
        if not json_blocks:
            # Try plain JSON objects
            json_blocks = re.findall(r'({\s*"name"\s*:.*?})', text, re.DOTALL)

        for block in json_blocks:
            try:
                data = json.loads(block)
                if isinstance(data, dict) and data.get("name") in valid_tool_names:
                    parsed.append({
                        "name": data["name"],
                        "arguments": data.get("arguments", data.get("params", {})),
                    })
            except (json.JSONDecodeError, TypeError):
                continue

        return parsed

    def _looks_like_json_tool_call(self, text: str) -> bool:
        """Check if text looks like a raw JSON tool call rather than natural language."""
        stripped = text.strip()
        if stripped.startswith('{') and stripped.endswith('}'):
            try:
                data = json.loads(stripped)
                return "name" in data or "function" in data
            except (json.JSONDecodeError, TypeError):
                pass
        return False

    # ─────────────────────────────────────────────────────────────────────────
    # Gemini Agentic Loop (google-genai SDK) — Cloud Fallback
    # ─────────────────────────────────────────────────────────────────────────

    def _run_gemini(self, user_text: str, history: List[Dict], gps: Optional[Dict]) -> Dict[str, Any]:
        tools_used = []

        expanded_text = self._expand_follow_up_user_text(user_text, history)
        enriched_text = self._enrich_with_gps(expanded_text, gps)

        # Build full conversation contents list
        contents = []
        for turn in history:
            role = turn.get("role", "user")
            parts_text = turn.get("parts", [""])
            contents.append(
                self.gemini_types.Content(
                    role=role,
                    parts=[self.gemini_types.Part.from_text(text=p) for p in parts_text]
                )
            )
        # Add current user message
        contents.append(
            self.gemini_types.Content(
                role="user",
                parts=[self.gemini_types.Part.from_text(text=enriched_text)]
            )
        )

        # Build tool declarations for Gemini
        tool_declarations = self._build_gemini_tool_declarations()

        config = self.gemini_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[self.gemini_types.Tool(function_declarations=tool_declarations)],
            temperature=0.1,   # Low temp = factual, consistent answers
        )

        try:
            # Agentic loop
            for iteration in range(self.MAX_TOOL_ITERATIONS):
                response = self.gemini_client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=contents,
                    config=config,
                )

                # Check if model wants to call tools
                tool_calls = []
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        tool_calls.append(part.function_call)

                if not tool_calls:
                    # No tool calls → final text answer
                    break

                logger.info(
                    "[Agent/Gemini] Iteration %d: tools called: %s",
                    iteration + 1,
                    [c.name for c in tool_calls],
                )

                # Add model's tool-request turn to contents
                contents.append(response.candidates[0].content)

                # Execute tools and build response parts
                tool_result_parts = []
                for call in tool_calls:
                    params = dict(call.args)
                    result = self.tool_executor.execute(call.name, params, gps)

                    tools_used.append({
                        "tool": call.name,
                        "params": params,
                        "result": result,
                    })

                    tool_result_parts.append(
                        self.gemini_types.Part.from_function_response(
                            name=call.name,
                            response={"result": result},
                        )
                    )

                # Add tool results as "tool" role turn
                contents.append(
                    self.gemini_types.Content(role="tool", parts=tool_result_parts)
                )

            # Extract final text
            final_text = ""
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    final_text += part.text

            final_text = final_text.strip() or (
                "I couldn't find specific information. Please rephrase or consult official sources."
            )

            return {
                "status": "ok",
                "response": final_text,
                "tools_used": tools_used,
                "agent_powered": True,
                "model": "gemini-2.0-flash",
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[Agent/Gemini] Error: {error_msg}")

            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                logger.info("[Agent] Gemini rate-limited. Falling back to local NLP.")

            fallback = self._keyword_fallback(user_text, gps)
            fallback["error_detail"] = error_msg
            return fallback

    def _build_gemini_tool_declarations(self) -> list:
        """Convert tool definitions dict to Gemini FunctionDeclaration objects."""
        from google.genai import types

        declarations = []
        for tool in TOOL_DEFINITIONS_RAW:
            declarations.append(
                types.FunctionDeclaration(
                    name=tool["name"],
                    description=tool["description"],
                    parameters=tool["parameters"],
                )
            )
        return declarations

    # ─────────────────────────────────────────────────────────────────────────
    # Keyword Fallback (No AI Available)
    # ─────────────────────────────────────────────────────────────────────────

    def _keyword_fallback(self, text: str, gps: Optional[Dict]) -> Dict[str, Any]:
        text_lower = text.lower()
        tools_used = []
        response_parts = []

        fine_keywords = ["fine", "penalty", "challan", "amount", "how much", "cost"]
        if any(k in text_lower for k in fine_keywords):
            offence = self._detect_offence(text_lower)
            vehicle = self._detect_vehicle(text_lower)
            state = self._detect_state(text_lower)
            if offence:
                result = self.tool_executor.execute(
                    "lookup_fine",
                    {"offence_type": offence, "vehicle_class": vehicle, "state": state},
                    gps,
                )
                tools_used.append({"tool": "lookup_fine", "result": result})
                # Human-readable offence names
                offence_names = {
                    "NO_HELMET": "No Helmet", "DRUNK_DRIVING": "Drunk Driving",
                    "SPEED_EXCESS": "Over Speeding", "NO_LICENSE": "Driving Without License",
                    "MOBILE_PHONE": "Using Mobile Phone While Driving",
                    "NO_INSURANCE": "No Insurance", "SECTION_177": "Jumping Red Light",
                    "SECTION_179": "Wrong Way Driving", "SECTION_184": "Dangerous/Rash Driving",
                    "SECTION_194D": "No Seatbelt",
                }
                display_name = offence_names.get(offence, offence)
                
                if result.get("found"):
                    response_parts.append(
                        f"💰 **Fine for {display_name} ({vehicle}):**\n"
                        f"   • Amount: ₹{result['amount_inr']}\n"
                        f"   • Repeat Offence: ₹{result.get('repeat_amount_inr', 'N/A')}\n"
                        f"   • Section: {result.get('section_ref', 'N/A')}\n"
                        f"   • State: {result.get('state', state)}"
                    )
                else:
                    # Second attempt: try without state restriction if state was 'ALL'
                    if state == "ALL":
                        all_state_result = self.tool_executor.execute(
                            "lookup_fine",
                            {"offence_type": offence, "vehicle_class": vehicle, "state": "ANY"},
                            gps,
                        )
                        if all_state_result.get("found"):
                            response_parts.append(
                                f"💰 **Fine for {display_name} ({vehicle}) in {all_state_result.get('state', 'India')}:**\n"
                                f"   • Amount: ₹{all_state_result['amount_inr']}\n"
                                f"   • Section: {all_state_result.get('section_ref', 'N/A')}\n"
                                f"   \n*(Note: This is the rule for {all_state_result.get('state')})*"
                            )
                        else:
                            response_parts.append(f"No fine data found for '{display_name}' in the database.")
                    else:
                        response_parts.append(f"No fine data found for '{display_name}' in {state}.")

        rule_keywords = ["rule", "law", "legal", "section", "act", "allowed", "permitted"]
        if any(k in text_lower for k in rule_keywords):
            result = self.tool_executor.execute(
                "search_rules", {"keywords": text_lower.split()[:4]}, gps
            )
            tools_used.append({"tool": "search_rules", "result": result})
            if result.get("found") and result.get("rules"):
                r = result["rules"][0]
                response_parts.append(f"{r['title']} ({r.get('section', '')}): {r['description']}")

        zone_keywords = ["zone", "area", "here", "location", "nearby", "restriction"]
        if gps and any(k in text_lower for k in zone_keywords):
            result = self.tool_executor.execute("check_zone", {}, gps)
            tools_used.append({"tool": "check_zone", "result": result})
            if result.get("found"):
                z = result["zones"][0]
                response_parts.append(f"Active zone: {z['name']} — {', '.join(z.get('rules', []))}")

        # ── Handle greetings ──────────────────────────────────────────────
        greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "namaste"]
        if text_lower.strip() in greetings:
            response_parts.append(
                "Hello! 👋 I'm DriveLegal AI — your Indian traffic law assistant.\n\n"
                "You can ask me things like:\n"
                "• \"What's the fine for no helmet?\"\n"
                "• \"Drunk driving penalty in Tamil Nadu\"\n"
                "• \"What are the rules for using high beam?\"\n"
                "• \"Speed limit in school zone\"\n\n"
                "How can I help you today?"
            )

        # ── Local NLP fallback: use HybridSearch for any unmatched query ──
        if not response_parts and self.hybrid_search:
            try:
                nlp_results = self.hybrid_search.search(text, top_k=3)
                # Filter out low-relevance results
                relevant = [r for r in nlp_results if r.get("score", 0) > 0.15]
                if relevant:
                    tools_used.append({"tool": "hybrid_search", "result": relevant})
                    response_parts.append("Here's what I found in the traffic law database:\n")
                    for i, r in enumerate(relevant, 1):
                        meta = r.get("metadata", {})
                        title = meta.get("title", "")
                        section = meta.get("section", "")
                        content = r.get("content", "")

                        # Clean up raw QA dataset formatting
                        if "###Assistant:" in content:
                            content = content.split("###Assistant:")[-1].strip()
                        if "###Human:" in content:
                            content = content.split("###Human:")[0].strip()
                        # Remove trailing answer-choice numbers
                        content = content.strip().rstrip("0123456789").strip()
                        if not content:
                            continue

                        header = f"**{title}**" if title else f"Result {i}"
                        if section and section != "QA Dataset":
                            header += f" (Section {section})"
                        response_parts.append(f"{i}. {header}\n   {content[:400]}")
            except Exception as e:
                logger.warning("[Agent] HybridSearch fallback error: %s", e)

        if not response_parts:
            response_parts = [
                "I couldn't find specific information. "
                "Try asking about a specific traffic rule, fine, or violation — e.g. 'fine for no helmet in Tamil Nadu'."
            ]

        response_parts.append("\n⚠️ This is informational only. Consult official sources.")

        return {
            "status": "fallback",
            "response": "\n".join(response_parts),
            "tools_used": tools_used,
            "agent_powered": False,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Fallback Helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _detect_offence(self, text: str) -> Optional[str]:
        offences = {
            "NO_HELMET": ["helmet"],
            "DRUNK_DRIVING": ["drunk", "alcohol", "daaru", "dui", "drink"],
            "SPEED_EXCESS": ["speed", "over speed", "fast", "speeding"],
            "SECTION_177": ["red light", "signal jump", "jumping red"],
            "NO_LICENSE": ["license", "licence", "dl"],
            "SECTION_194D": ["seatbelt", "seat belt"],
            "MOBILE_PHONE": ["mobile", "phone", "call while driving"],
            "SECTION_179": ["wrong way", "one way"],
            "SECTION_184": ["dangerous", "rash"],
            "NO_INSURANCE": ["insurance"],
        }
        for offence, keywords in offences.items():
            if any(k in text for k in keywords):
                return offence
        return None

    def _detect_vehicle(self, text: str) -> str:
        if any(k in text for k in ["bike", "scooter", "motorcycle", "two wheeler", "2w"]):
            return "TWO_WHEELER"
        if any(k in text for k in ["truck", "bus", "heavy", "lorry", "hgv"]):
            return "HGV"
        if any(k in text for k in ["auto", "rickshaw", "three wheeler", "3w"]):
            return "3W"
        if any(k in text for k in ["car", "jeep", "suv", "lmv"]):
            return "LMV"
        return "GENERAL"

    def _detect_state(self, text: str) -> str:
        states = {
            "Tamil Nadu": ["tamil nadu", "tn", "chennai", "coimbatore"],
            "Delhi": ["delhi", "dl", "new delhi"],
            "Maharashtra": ["maharashtra", "mumbai", "pune", "nagpur"],
            "Karnataka": ["karnataka", "bangalore", "bengaluru", "mysuru"],
            "Kerala": ["kerala", "kochi", "thiruvananthapuram"],
            "Uttar Pradesh": ["uttar pradesh", "up", "lucknow", "noida"],
            "Gujarat": ["gujarat", "ahmedabad", "surat"],
            "Rajasthan": ["rajasthan", "jaipur"],
            "West Bengal": ["west bengal", "kolkata"],
            "Telangana": ["telangana", "hyderabad"],
        }
        for state, keywords in states.items():
            if any(k in text for k in keywords):
                return state
        return "ALL"


# Raw tool defs for FunctionDeclaration building
from backend.modules.agent.tools import TOOL_DEFINITIONS as TOOL_DEFINITIONS_RAW
