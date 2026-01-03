import json
import os
import uuid
from datetime import datetime

class ProgressManager:
    def __init__(self, storage_path="student_progress.json"):
        self.storage_path = storage_path
        self._ensure_storage_exists()

    def _ensure_storage_exists(self):
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([], f)

    def save_progress(self, data: dict):
        """
        Appends a progress record to the storage.
        Ensures a unique attempt_id and immutability.
        """
        # 1. Load existing history
        history = self._get_all_history()
        
        # 2. Add System Metadata
        record = data.copy()
        record["attempt_id"] = str(uuid.uuid4())
        record["timestamp"] = datetime.now().isoformat()
        
        # 3. Append and Save
        history.append(record)
        
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4, ensure_ascii=False)
            
        print(f"📊 Progress Saved: {record['attempt_id']} | Type: {record.get('type')} | Student: {record.get('student_name')}")
        return record["attempt_id"]

    def get_history(self, student_name: str = None, student_class: str = None):
        """
        Retrieves history filtered by student identity.
        """
        history = self._get_all_history()
        
        filtered = []
        for item in history:
            # Match if provided
            name_match = (not student_name) or (item.get("student_name") == student_name)
            class_match = (not student_class) or (item.get("student_class") == student_class)
            
            if name_match and class_match:
                filtered.append(item)
                
        # Sort by timestamp descending (newest first)
        filtered.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return filtered

    def _get_all_history(self):
        try:
            if not os.path.exists(self.storage_path):
                return []
            with open(self.storage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Error reading progress storage: {e}")
            return []
