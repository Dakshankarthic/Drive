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
                return {
                    "status": "rate_limit",
                    "response": "⚠️ AI Rate Limit Reached! You have asked too many questions too quickly. Please wait 30 seconds and try again.",
                    "tools_used": [],
                    "agent_powered": False,
                }
                
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

        fine_keywords = ["fine", "penalty", "challan", "amount", "how much"]
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
                if result.get("found"):
                    response_parts.append(
                        f"Fine for {offence} ({vehicle}) in {state}: ₹{result['amount_inr']}"
                    )
                    if result.get("section_ref"):
                        response_parts.append(f"Section: {result['section_ref']}")
                else:
                    response_parts.append(f"No fine data found for '{offence}' in {state}.")

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

        if not response_parts:
            response_parts = [
                "I couldn't find specific information. "
                "Try: 'fine for no helmet in Tamil Nadu' or add GEMINI_API_KEY for full AI."
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
            "no helmet": ["helmet"],
            "drunk driving": ["drunk", "alcohol", "daaru", "dui", "drink"],
            "speeding": ["speed", "over speed", "fast"],
            "jumping red light": ["red light", "signal jump"],
            "no license": ["license", "licence"],
            "no seatbelt": ["seatbelt", "seat belt"],
            "mobile phone use": ["mobile", "phone", "call while driving"],
            "wrong way": ["wrong way", "one way"],
            "dangerous driving": ["dangerous", "rash"],
        }
        for offence, keywords in offences.items():
            if any(k in text for k in keywords):
                return offence
        return None

    def _detect_vehicle(self, text: str) -> str:
        if any(k in text for k in ["bike", "scooter", "motorcycle", "two wheeler", "2w"]):
            return "2W"
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


