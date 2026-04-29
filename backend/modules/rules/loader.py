import json
import os
from typing import List, Dict, Optional

class RulesLoader:
    def __init__(self, rules_path: str):
        self.rules_path = rules_path
        self.rules: List[Dict] = []
        self.rule_id_index: Dict[str, Dict] = {}
        self.offence_code_index: Dict[str, Dict] = {}
        self._load_rules()

    def _load_rules(self):
        if not os.path.exists(self.rules_path):
            return

        with open(self.rules_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.rules = data.get("rules", [])

        for rule in self.rules:
            self.rule_id_index[rule["rule_id"]] = rule
            for offence_code in rule.get("related_offence_codes", []):
                self.offence_code_index[offence_code] = rule

    def get_by_rule_id(self, rule_id: str) -> Optional[Dict]:
        """Returns the rule with the given rule_id."""
        return self.rule_id_index.get(rule_id)

    def get_by_offence_code(self, offence_code: str, state: str = "ALL") -> Optional[Dict]:
        """
        Returns the rule associated with the offence_code.
        Priority: state-specific override > national rule > None
        Note: The rule returned will include the base rule data, 
        potentially merged or noted with state override.
        """
        rule = self.offence_code_index.get(offence_code)
        if not rule:
            return None
        
        if state == "ALL":
            return rule

        # Check for state override within the rule
        override = self.get_state_override(rule["rule_id"], state)
        if override:
            # Create a copy and merge/apply override if needed
            # For now, following instructions to "return dict", 
            # we'll return the base rule but we can decide if we want 
            # to return the override data specifically. 
            # The prompt says "Priority: state-specific override > national rule".
            # This usually means if an override exists, we should probably 
            # indicate it or provide the overridden description.
            overridden_rule = rule.copy()
            overridden_rule["description"] = override.get("description", rule["description"])
            overridden_rule["is_state_override"] = True
            return overridden_rule
        
        return rule

    def search(self, query_tokens: List[str]) -> List[Dict]:
        """
        Simple token match on title + description — no embeddings, no LLM.
        Matches if all tokens are present in either title or description.
        """
        results = []
        query_tokens = [t.lower() for t in query_tokens]
        
        for rule in self.rules:
            title = rule.get("title", "").lower()
            description = rule.get("description", "").lower()
            
            match = True
            for token in query_tokens:
                if token not in title and token not in description:
                    match = False
                    break
            
            if match:
                results.append(rule)
        
        return results

    def get_state_override(self, rule_id: str, state: str) -> Optional[Dict]:
        """Returns the state-specific override for a rule if it exists."""
        rule = self.get_by_rule_id(rule_id)
        if not rule:
            return None
        
        overrides = rule.get("state_overrides", [])
        for override in overrides:
            if override["state"] == state:
                return override
        
        return None
