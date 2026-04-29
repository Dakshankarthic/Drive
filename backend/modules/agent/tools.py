"""
tools.py — Gemini-compatible tool (function) definitions for DriveLegal Agent.

Each tool wraps an existing backend module:
  - lookup_fine    → FineLookup (SQLite)
  - lookup_rule    → RulesLoader (rules.json)
  - check_zone     → GeofencingEngine (GeoJSON polygons)
  - search_rules   → RulesLoader.search()
"""

from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Function Declarations
# ─────────────────────────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "lookup_fine",
        "description": (
            "Look up the exact fine/penalty amount for a specific traffic violation in India. "
            "Use this when the user asks how much a challan costs, what the penalty is, "
            "or wants to know the fine for breaking a specific rule."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "offence_type": {
                    "type": "string",
                    "description": (
                        "The traffic violation in lowercase. "
                        "Examples: 'no helmet', 'speeding', 'drunk driving', "
                        "'jumping red light', 'wrong way', 'mobile phone use', "
                        "'no seatbelt', 'no license', 'dangerous driving'"
                    ),
                },
                "vehicle_class": {
                    "type": "string",
                    "description": (
                        "Type of vehicle. Use: "
                        "'2W' for bike/scooter/motorcycle, "
                        "'LMV' for car/jeep/light motor vehicle, "
                        "'HGV' for truck/bus/heavy vehicle, "
                        "'3W' for auto-rickshaw, "
                        "'GENERAL' if vehicle type is unspecified."
                    ),
                    "enum": ["2W", "LMV", "HGV", "3W", "GENERAL"],
                },
                "state": {
                    "type": "string",
                    "description": (
                        "Indian state name. Examples: 'Tamil Nadu', 'Delhi', "
                        "'Maharashtra', 'Karnataka', 'Kerala'. "
                        "Use 'ALL' for national/general rules when no state is mentioned."
                    ),
                },
                "is_repeat": {
                    "type": "boolean",
                    "description": "True if this is a repeat/second offence by the same person.",
                },
            },
            "required": ["offence_type", "vehicle_class", "state"],
        },
    },
    {
        "name": "lookup_rule",
        "description": (
            "Get the legal rule, Motor Vehicles Act section reference, and full description "
            "for a traffic violation. Use when the user asks what the law says, "
            "which section of the MV Act applies, or wants to understand the legal basis."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "offence_type": {
                    "type": "string",
                    "description": (
                        "The traffic violation keyword. "
                        "Examples: 'NO_HELMET', 'DRUNK_DRIVING', 'SPEED_EXCESS', "
                        "'NO_LICENSE', 'RED_LIGHT_JUMPING', 'DANGEROUS_DRIVING'. "
                        "You can also pass plain text like 'helmet' or 'drunk driving'."
                    ),
                },
                "state": {
                    "type": "string",
                    "description": (
                        "Indian state for state-specific rule overrides. "
                        "Use 'ALL' for the national baseline rule."
                    ),
                },
            },
            "required": ["offence_type"],
        },
    },
    {
        "name": "check_zone",
        "description": (
            "Check what traffic zone restrictions (school zones, no-horn zones, "
            "speed-restricted areas, etc.) are active at a specific GPS location. "
            "Use when the user asks about restrictions at their current location "
            "or when GPS coordinates are available."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "lat": {
                    "type": "number",
                    "description": "Latitude of the location (e.g., 13.0827 for Chennai).",
                },
                "lon": {
                    "type": "number",
                    "description": "Longitude of the location (e.g., 80.2707 for Chennai).",
                },
            },
            "required": ["lat", "lon"],
        },
    },
    {
        "name": "search_rules",
        "description": (
            "Search through all traffic rules using keywords when you don't know the "
            "exact offence code. Use for general legal questions, multi-topic queries, "
            "or exploratory questions about Indian traffic law."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of search keywords. "
                        "Example: ['helmet', 'mandatory'] or ['drunk', 'driving', 'BAC']"
                    ),
                },
            },
            "required": ["keywords"],
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Tool Executor
# ─────────────────────────────────────────────────────────────────────────────

class ToolExecutor:
    """
    Bridges Gemini tool calls to the actual backend modules.
    Each method corresponds to one tool definition above.
    """

    def __init__(self, fine_lookup, rules_loader, geofencing_engine):
        self.fine_lookup = fine_lookup
        self.rules_loader = rules_loader
        self.geofencing = geofencing_engine

    def execute(self, tool_name: str, params: dict, gps: Optional[dict] = None) -> dict:
        """Route a tool call to the right handler."""
        logger.info(f"[Agent Tool] {tool_name}({params})")
        try:
            handlers = {
                "lookup_fine": self._lookup_fine,
                "lookup_rule": self._lookup_rule,
                "check_zone": self._check_zone,
                "search_rules": self._search_rules,
            }
            handler = handlers.get(tool_name)
            if not handler:
                return {"error": f"Unknown tool: {tool_name}"}
            return handler(params, gps)
        except Exception as e:
            logger.error(f"[Agent Tool] Error in {tool_name}: {e}")
            return {"error": str(e)}

    # ── Individual tool handlers ──────────────────────────────────────────────

    def _lookup_fine(self, params: dict, gps: Optional[dict]) -> dict:
        if not self.fine_lookup:
            return {"error": "Fine database not available"}

        # Clean the AI's input to perfectly match our UPPER_SNAKE_CASE database format
        clean_offence_code = params.get("offence_type", "").upper().replace(" ", "_")
        
        result = self.fine_lookup.query(
            offence_code=clean_offence_code,
            vehicle_class=params.get("vehicle_class", "GENERAL"),
            state=params.get("state", "ALL"),
            repeat=params.get("is_repeat", False),
        )

        if result:
            return {
                "found": True,
                "amount_inr": result.get("amount_inr"),
                "repeat_amount_inr": result.get("repeat_amount_inr"),
                "section_ref": result.get("section_ref"),
                "source_url": result.get("source_url"),
                "data_as_of": result.get("fetched_at"),
            }

        # Soft fallback: search for similar offences
        all_fines = self.fine_lookup.get_all()
        offence_key = params.get("offence_type", "").lower().replace("_", " ")
        similar = [
            f for f in all_fines
            if offence_key in f.get("offence_code", "").lower().replace("_", " ") or f.get("offence_code", "").lower().replace("_", " ") in offence_key
        ][:3]

        return {
            "found": False,
            "message": "No exact match. Showing similar entries.",
            "similar": similar,
        }

    def _lookup_rule(self, params: dict, gps: Optional[dict]) -> dict:
        if not self.rules_loader:
            return {"error": "Rules database not available"}

        offence_input = params.get("offence_type", "")
        state = params.get("state", "ALL")

        # Try exact offence code first (e.g., "NO_HELMET")
        result = self.rules_loader.get_by_offence_code(offence_input.upper(), state)

        # Fallback: keyword search
        if not result:
            keywords = offence_input.lower().split()
            results = self.rules_loader.search(keywords)
            result = results[0] if results else None

        if result:
            return {
                "found": True,
                "rule_id": result.get("rule_id"),
                "section": result.get("section"),
                "act": result.get("act"),
                "title": result.get("title"),
                "description": result.get("description"),
                "is_state_override": result.get("is_state_override", False),
                "state": state,
            }

        return {
            "found": False,
            "message": f"No specific rule found for '{offence_input}' in {state}.",
        }

    def _check_zone(self, params: dict, gps: Optional[dict]) -> dict:
        # Use provided params, fall back to request GPS
        lat = params.get("lat") or (gps.get("lat") if gps else None)
        lon = params.get("lon") or (gps.get("lon") if gps else None)

        if lat is None or lon is None:
            return {"error": "No GPS coordinates available"}

        if not self.geofencing:
            return {"error": "Geofencing engine not available"}

        zones = self.geofencing.get_applicable_rules(lat, lon)
        if not zones:
            return {
                "found": False,
                "lat": lat,
                "lon": lon,
                "message": "No special traffic zones found at this location.",
            }

        return {
            "found": True,
            "lat": lat,
            "lon": lon,
            "zone_count": len(zones),
            "zones": [
                {
                    "name": z.get("name") or z.get("zone_id", "Unknown Zone"),
                    "zone_type": z.get("zone_type"),
                    "active_hours": z.get("active_hours", "ALL"),
                    "rules": z.get("rules", []),
                }
                for z in zones
            ],
        }

    def _search_rules(self, params: dict, gps: Optional[dict]) -> dict:
        if not self.rules_loader:
            return {"error": "Rules database not available"}

        keywords = params.get("keywords", [])
        if not keywords:
            return {"error": "No keywords provided"}

        results = self.rules_loader.search([k.lower() for k in keywords])
        if not results:
            return {
                "found": False,
                "message": f"No rules found for keywords: {keywords}",
            }

        return {
            "found": True,
            "count": len(results),
            "rules": [
                {
                    "rule_id": r.get("rule_id"),
                    "section": r.get("section"),
                    "title": r.get("title"),
                    "description": r.get("description"),
                }
                for r in results[:5]  # top 5 matches
            ],
        }
