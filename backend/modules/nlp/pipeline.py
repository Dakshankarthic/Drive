import logging
from .normalizer import normalize
from .intent_classifier import IntentClassifier
from .entity_extractor import EntityExtractor
from .context_resolver import resolve

class NLPPipeline:
    def __init__(self):
        self.classifier = IntentClassifier()
        self.extractor = EntityExtractor()

    def run(self, raw_text: str, session: dict = {}, gps: dict | None = None) -> dict:
        """
        Runs the full NLP pipeline: normalize -> classify -> extract -> resolve.
        Returns a structured dictionary with appropriate status.
        """
        try:
            # 1. Normalization
            clean_text = normalize(raw_text)
            
            # 2. Intent Classification
            intent = self.classifier.predict(clean_text)
            
            # 3. Entity Extraction
            entities = self.extractor.extract(clean_text)
            
            # 4. Context Resolution
            resolved_entities = resolve(entities, session, gps)
            
            result = {
                "intent": intent,
                "offence_type": resolved_entities.get("offence_type"),
                "vehicle_class": resolved_entities.get("vehicle_class"),
                "state": resolved_entities.get("state"),
                "repeat_offence": resolved_entities.get("repeat_offence"),
                "section_ref": resolved_entities.get("section_ref"),
                "confidence": 0.8 if intent != "unknown" else 0.0,
                "status": "success"
            }

            # Insufficient info check
            if intent == "unknown" or result["offence_type"] is None:
                result["status"] = "insufficient_info"
            
            return result

        except Exception as e:
            logging.error(f"NLP Pipeline Error: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
