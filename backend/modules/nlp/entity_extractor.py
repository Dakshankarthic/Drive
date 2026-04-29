import spacy
from spacy.matcher import Matcher
import os
import json

class EntityExtractor:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback to blank model if not installed
            self.nlp = spacy.blank("en")
            
        self.matcher = Matcher(self.nlp.vocab)
        
        # MV Act section refs (pattern: "section" + number)
        # Using [ {"LOWER": "section"}, {"IS_DIGIT": True} ]
        section_pattern = [{"LOWER": "section"}, {"IS_DIGIT": True}]
        self.matcher.add("SECTION_REF", [section_pattern])

        # <<DATASET: replace hardcoded patterns with spaCy EntityRuler patterns from nlp/patterns.jsonl>>
        patterns_path = os.path.join(os.path.dirname(__file__), "patterns.jsonl")
        if os.path.exists(patterns_path):
            if "entity_ruler" not in self.nlp.pipe_names:
                ruler = self.nlp.add_pipe("entity_ruler")
                ruler.from_disk(patterns_path)

        # Hardcode vehicle class keywords
        self.vehicle_classes = {
            "two wheeler": "2W", 
            "bike": "2W", 
            "car": "LMV", 
            "truck": "HGV", 
            "auto": "3W"
        }

    def extract(self, text: str) -> dict:
        """
        Extract entities: offence_type, vehicle_class, state, repeat_offence, section_ref
        """
        doc = self.nlp(text)
        entities = {
            "offence_type": None,
            "vehicle_class": None,
            "state": None,
            "repeat_offence": None,
            "section_ref": None
        }

        # 1. Extract Vehicle Class
        text_lower = text.lower()
        for key, val in self.vehicle_classes.items():
            if key in text_lower:
                entities["vehicle_class"] = val
                break

        # 2. Extract Section Ref via Matcher
        matches = self.matcher(doc)
        if matches:
            # Take the first match
            _, start, end = matches[0]
            entities["section_ref"] = doc[start:end].text

        # 3. Extract State (using spaCy GPE or fallback list)
        for ent in doc.ents:
            if ent.label_ == "GPE":
                entities["state"] = ent.text
                break
        
        if entities["state"] is None:
            # Fallback for common states (especially useful if text is lowercased)
            states = ["tamil nadu", "karnataka", "maharashtra", "delhi", "kerala", "andhra pradesh", "telangana", "gujarat", "punjab", "haryana", "uttar pradesh", "west bengal", "rajasthan", "madhya pradesh"]
            for state in states:
                if state in text_lower:
                    entities["state"] = state.title()
                    break

        # 4. Repeat Offence detection
        repeat_keywords = ["again", "second", "repeat", "previous", "twice"]
        if any(keyword in text_lower for keyword in repeat_keywords):
            entities["repeat_offence"] = "true"

        # 5. Offence Type (Placeholder logic - strictly extraction, no inference)
        # For the sake of the pipeline, we might need a basic list of offences if they appear in text
        # But per prompt requirements, we leave it as None if not explicitly found.
        # Simple extraction if it looks like an offence phrase (will be improved by patterns.jsonl)
        # For basic testing, if "jumping red light" is in text, we'll take it as offence_type
        # This is a minimal bridge until DATASET is provided
        common_offences = ["jumping red light", "speeding", "drunk driving", "no helmet", "wrong way"]
        for offence in common_offences:
            if offence in text_lower:
                entities["offence_type"] = offence
                break

        return entities
