import json
import os
import time
from typing import List, Dict, Optional

class ChatManager:
    def __init__(self, storage_file="student_chats.json"):
        self.storage_file = storage_file
        self.chats = self._load_chats()

    def _load_chats(self) -> List[Dict]:
        if not os.path.exists(self.storage_file):
            return []
        try:
            with open(self.storage_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Failed to load chats: {e}")
            return []

    def _save_chats(self):
        try:
            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump(self.chats, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"❌ Failed to save chats: {e}")

    def get_all_chats(self, student_name: Optional[str] = None) -> List[Dict]:
        if not student_name:
            return self.chats
        
        # Filter by student name (case-insensitive for safety)
        filtered = []
        target_name = student_name.strip().lower()
        
        for chat in self.chats:
            # Check if chat has owner
            owner = chat.get("studentName", "").strip().lower()
            if owner == target_name:
                filtered.append(chat)
            # Optional: Decide if we want to show 'legacy' chats (no owner) to everyone or no one.
            # For privacy, better to show only owned chats if a name is requested.
            # If a chat has no 'studentName', it might be from before this feature.
            # We could assign them to the first user or just hide them.
            # Let's hide them from specific user queries to be safe.
            
        return filtered

    def get_chat(self, chat_id: str) -> Optional[Dict]:
        for chat in self.chats:
            if chat["id"] == chat_id:
                return chat
        return None

    def save_chat_turn(self, chat_id: str, user_msg: str, bot_response: str, sources: List[str], metadata: Dict):
        """
        Updates an existing chat or creates a new one if it doesn't exist
        """
        # Search for existing chat
        existing_chat = None
        for chat in self.chats:
            if chat["id"] == chat_id:
                existing_chat = chat
                break
        
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        
        user_entry = {
            "role": "user",
            "content": user_msg,
            "timestamp": timestamp
        }
        
        bot_entry = {
            "role": "assistant",
            "content": bot_response,
            "sources": sources,
            "timestamp": timestamp
        }
        
        if existing_chat:
            existing_chat["messages"].append(user_entry)
            existing_chat["messages"].append(bot_entry)
            existing_chat["updated_at"] = timestamp
            # Update title only if it's the first turn and title is generic
            if len(existing_chat["messages"]) <= 3 and existing_chat["title"] in ["New Chat", "AI Chat Tutor"]:
                 existing_chat["title"] = user_msg[:30] + "..." if len(user_msg) > 30 else user_msg
        else:
            # Create new chat
            title = user_msg[:30] + "..." if len(user_msg) > 30 else user_msg
            if metadata.get("title"):
                title = metadata.get("title")

            new_chat = {
                "id": chat_id,
                "title": title,
                "bookId": metadata.get("bookId"),
                "bookName": metadata.get("bookName"),
                "subject": metadata.get("subject"),
                "className": metadata.get("className"),
                "studentName": metadata.get("studentName"),
                "messages": [
                    # Assuming we might want to capture the initial greeting or just start here
                    user_entry,
                    bot_entry
                ],
                "created_at": timestamp,
                "updated_at": timestamp
            }
            # If there was an initial "system" or "assistant" greeting that wasn't user-provoked, 
            # it should have been handled by the frontend syncing the full state.
            # But here we are recording a turn.
            
            self.chats.insert(0, new_chat) # Add to top
        
        self._save_chats()
        return True

    def sync_chat_state(self, chat_object: Dict):
        """
        Full sync of a chat object from frontend to backend.
        Useful for when a chat is created with an initial greeting before user types.
        """
        chat_id = chat_object.get("id")
        found = False
        for i, chat in enumerate(self.chats):
            if chat["id"] == chat_id:
                self.chats[i] = chat_object
                found = True
                break
        
        if not found:
            self.chats.insert(0, chat_object)
            
        self._save_chats()
        return True

    def delete_chat(self, chat_id: str):
        self.chats = [c for c in self.chats if c["id"] != chat_id]
        self._save_chats()
        return True
