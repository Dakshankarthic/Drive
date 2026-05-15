"""
engine.py — DriveLegal Agent Engine

Architecture (Agentic Loop):
───────────────────────────────────────────────────────────────
User message
    │
    ▼
Gemini 2.5 Flash (with tools + system prompt)
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

SDK: google-genai (new, replaces deprecated google-generativeai)
Model: gemini-2.5-flash
"""

import os
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
1. Always use the provided tools — never guess fine amounts or law sections.
2. Always cite the MV Act section number when mentioning a rule.
3. Use ₹ symbol for Indian Rupee amounts.
4. If the database has no data, say so clearly. Never fabricate.
5. For repeat offences, always mention the higher penalty.
6. Be concise, clear, and structured. Use bullet points for multiple items.
7. Always end with: "⚠️ This is informational only. Consult official sources or a legal professional for official advice."
8. If GPS is available in the conversation context, proactively check for zone restrictions.
9. Infer the vehicle type from context (e.g., "bike" = 2W, "car" = LMV).

TONE: Professional, helpful, government-branded. Not casual."""


# ─────────────────────────────────────────────────────────────────────────────
# Agent Engine
# ─────────────────────────────────────────────────────────────────────────────

class AgentEngine:
    """
    Main AI agent using Gemini 2.5 Flash with function calling (google-genai SDK).
    Falls back to keyword-based matching if GEMINI_API_KEY is not set.
    """

    MAX_TOOL_ITERATIONS = 5

    def __init__(self, fine_lookup, rules_loader, geofencing_engine):
        self.tool_executor = ToolExecutor(fine_lookup, rules_loader, geofencing_engine)
        self.client = None
        self.gemini_available = False
        self.hybrid_search = None

        # ── Local NLP (HybridSearch) for offline fallback ──────────────────
        try:
            from backend.modules.nlp.hybrid_search import HybridSearch
            rules_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "rules.json")
            persist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "vector_db")
            self.hybrid_search = HybridSearch(rules_path, persist_dir)
            logger.info("[Agent] Local NLP (HybridSearch) loaded with %d documents.", len(self.hybrid_search.documents))
        except Exception as e:
            logger.warning("[Agent] HybridSearch unavailable (%s). Keyword-only fallback.", e)

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning(
                "[Agent] GEMINI_API_KEY not set. Running in keyword-fallback mode."
            )
            return

        try:
            from google import genai
            from google.genai import types
            self.client = genai.Client(api_key=api_key)
            self.types = types
            self.gemini_available = True
            logger.info("[Agent] Gemini 2.0 Flash ready with tool calling.")
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
        if self.gemini_available:
            return self._run_gemini(user_text, conversation_history or [], gps)
        return self._keyword_fallback(user_text, gps)

    # ─────────────────────────────────────────────────────────────────────────
    # Gemini Agentic Loop (google-genai SDK)
    # ─────────────────────────────────────────────────────────────────────────

    def _run_gemini(self, user_text: str, history: List[Dict], gps: Optional[Dict]) -> Dict[str, Any]:
        tools_used = []

        # Inject GPS into message context if available
        enriched_text = user_text
        if gps:
            enriched_text += (
                f"\n\n[System context: User GPS lat={gps.get('lat')}, "
                f"lon={gps.get('lon')}. Check zone restrictions if relevant.]"
            )

        # Build full conversation contents list
        contents = []
        for turn in history:
            role = turn.get("role", "user")
            parts_text = turn.get("parts", [""])
            contents.append(
                self.types.Content(
                    role=role,
                    parts=[self.types.Part.from_text(text=p) for p in parts_text]
                )
            )
        # Add current user message
        contents.append(
            self.types.Content(
                role="user",
                parts=[self.types.Part.from_text(text=enriched_text)]
            )
        )

        # Build tool declarations for Gemini
        tool_declarations = self._build_tool_declarations()

        config = self.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[self.types.Tool(function_declarations=tool_declarations)],
            temperature=0.1,   # Low temp = factual, consistent answers
        )

        try:
            # Agentic loop
            for iteration in range(self.MAX_TOOL_ITERATIONS):
                response = self.client.models.generate_content(
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
                    "[Agent] Iteration %d: tools called: %s",
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
                        self.types.Part.from_function_response(
                            name=call.name,
                            response={"result": result},
                        )
                    )

                # Add tool results as "tool" role turn
                contents.append(
                    self.types.Content(role="tool", parts=tool_result_parts)
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
            logger.error(f"[Agent] Gemini error: {error_msg}")
            
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                logger.info("[Agent] Gemini rate-limited. Falling back to local NLP.")
                
            fallback = self._keyword_fallback(user_text, gps)
            fallback["error_detail"] = error_msg
            return fallback

    def _build_tool_declarations(self) -> list:
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
    # Keyword Fallback (No API Key)
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


