import json
import os
import uuid
from datetime import datetime

class StudentProgressManager:
    def __init__(self, storage_path="student_progress.json"):
        self.storage_path = storage_path
        self._ensure_storage()

    def _ensure_storage(self):
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def save_attempt(self, attempt_data):
        """
        Saves a new learning attempt.
        attempt_data should contain: type, student_name, student_class, subject, book_id, book_name, score, total_questions, questions
        """
        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            # Add unique ID and timestamp if not present
            record = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                **attempt_data
            }
            
            history.append(record)
            
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
                
            return True, record["id"]
        except Exception as e:
            print(f"Error saving progress: {e}")
            return False, str(e)

    def get_history(self, student_name=None, student_class=None):
        """Retrieves history, optionally filtered by student."""
        try:
            if not os.path.exists(self.storage_path):
                return []
                
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            if student_name and student_class:
                return [r for r in history if r.get("student_name") == student_name and r.get("student_class") == student_class]
                
            return history
        except Exception as e:
            print(f"Error loading history: {e}")
            return []

    def get_attempt_details(self, attempt_id):
        """Retrieves full details for a specific attempt."""
        try:
            with open(self.storage_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            for attempt in history:
                if attempt.get("id") == attempt_id:
                    return attempt
            return None
        except Exception as e:
            print(f"Error loading attempt details: {e}")
            return None
