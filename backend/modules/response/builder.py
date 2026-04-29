from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class ResponseBuilder:
    def __init__(self, fine_lookup: Any, rules_loader: Any, geofencing_engine: Any):
        """
        Inject dependencies for fines, rules, and geofencing.
        """
        self.fine_lookup = fine_lookup
        self.rules_loader = rules_loader
        self.geofencing_engine = geofencing_engine

    def build(self, nlp_result: Dict[str, Any], gps: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Assemble the final structured response based on NLP intent and GPS context.
        """
        status = "ok"
        intent = nlp_result.get("intent", "unknown")
        warnings = []
        
        # Initialize default response structure
        response = {
            "status": "ok",
            "intent": intent,
            "query_summary": self._generate_summary(nlp_result),
            "fine": None,
            "rule": None,
            "zone": None,
            "offline_mode": True, # Always offline-first logic unless specified
            "warnings": warnings
        }

        # 0. Handle Geofencing (always check if gps present regardless of intent/status)
        if gps and self.geofencing_engine:
            lat = gps.get("lat")
            lon = gps.get("lon")
            if lat is not None and lon is not None:
                applicable_zones = self.geofencing_engine.get_applicable_rules(lat, lon)
                response["zone"] = {
                    "active_zones": [z.get("name") or z.get("zone_id") for z in applicable_zones],
                    "applicable_rules": [z.get("rules", []) for z in applicable_zones]
                }

        if nlp_result.get("status") == "insufficient_info":
            response["status"] = "insufficient_info"
            return response

        if nlp_result.get("status") == "error":
            response["status"] = "error"
            return response

        offence_code = nlp_result.get("offence_type")
        state = nlp_result.get("state", "ALL")
        vehicle_class = nlp_result.get("vehicle_class", "GENERAL")
        is_repeat = nlp_result.get("repeat_offence", False)

        # 1. Handle Fines
        if intent == "fine_lookup":
            if not offence_code:
                response["status"] = "insufficient_info"
                return response
                
            if self.fine_lookup:
                fine_data = self.fine_lookup.query(offence_code, vehicle_class, state, is_repeat)
                if fine_data:
                    response["fine"] = {
                        "amount_inr": fine_data.get("amount_inr"),
                        "repeat_amount_inr": fine_data.get("repeat_amount_inr"),
                        "section_ref": fine_data.get("section_ref"),
                        "source_url": fine_data.get("source_url"),
                        "data_as_of": fine_data.get("fetched_at")
                    }
                else:
                    response["status"] = "not_found"
                    response["fine"] = None
                    
                    # Try to get ANY source_url for this offence
                    fallback_url = "official government sources"
                    try:
                        all_fines = self.fine_lookup.get_all()
                        for f in all_fines:
                            if f.get("offence_code") == offence_code and f.get("source_url"):
                                fallback_url = f.get("source_url")
                                break
                    except:
                        pass
                    warnings.append(f"Fine data not available for this combination. Check {fallback_url}.")
            else:
                response["status"] = "keyword_fallback"
                warnings.append("Fine database not loaded. Results may be generic.")

        # 2. Handle Rules
        if (intent == "rule_query" or (intent == "fine_lookup" and response["status"] == "ok")) and self.rules_loader:
            # Often fine queries also want rule context
            rule_data = self.rules_loader.get_by_offence_code(offence_code, state)
            if rule_data:
                response["rule"] = {
                    "rule_id": rule_data.get("rule_id"),
                    "title": rule_data.get("title"),
                    "description": rule_data.get("description"),
                    "state_override": state if rule_data.get("is_state_override") else None
                }

        # Final status check if nothing found for rule_query
        if intent == "rule_query" and not response["rule"]:
            response["status"] = "not_found"

        return response

    def _generate_summary(self, nlp_result: Dict[str, Any]) -> str:
        intent = nlp_result.get("intent")
        offence = nlp_result.get("offence_type", "unknown offence")
        state = nlp_result.get("state", "India")
        vehicle = nlp_result.get("vehicle_class", "vehicle")
        
        if intent == "fine_lookup":
            return f"Looking up fine for {offence} ({vehicle}) in {state}."
        elif intent == "rule_query":
            return f"Retrieving traffic rules for {offence} in {state}."
        elif intent == "zone_check":
            return f"Checking for local traffic zones and restricted areas."
        else:
            return "Searching for traffic law information."
