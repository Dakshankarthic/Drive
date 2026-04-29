import logging
import os

class IntentClassifier:
    def __init__(self):
        # <<DATASET: replace keyword fallback with fine-tuned DistilBERT from nlp/models/intent_model/>>
        self.model = None
        model_path = os.path.join(os.path.dirname(__file__), "models", "intent_model")
        if os.path.exists(model_path):
            # Placeholder for model loading logic
            logging.info(f"Loading intent model from {model_path}")
            pass
        
        # Keyword fallback rules
        self.rules = {
            "fine_lookup": ["fine", "penalty", "challan", "amount"],
            "rule_query": ["rule", "legal", "allowed", "permitted"],
            "zone_check": ["zone", "area", "here", "location"]
        }

    def predict(self, text: str) -> str:
        """
        Predict intent: "fine_lookup", "rule_query", "zone_check", "unknown"
        """
        predicted_intent = "unknown"
        confidence = 0.0

        # Use keyword fallback
        for intent, keywords in self.rules.items():
            if any(keyword in text for keyword in keywords):
                predicted_intent = intent
                confidence = 0.8  # Arbitrary confidence for keyword matches
                break

        # Log confidence score alongside prediction
        logging.info(f"NLP Intent Prediction: {predicted_intent} | Confidence: {confidence:.2f} | Text: {text}")
        
        return predicted_intent
