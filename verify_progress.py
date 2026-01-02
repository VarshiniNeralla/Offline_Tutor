import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_progress_tracking():
    print("🚀 Starting Progress Tracking Verification...")
    
    # 1. Define dummy attempt data
    payload = {
        "type": "quiz",
        "student_name": "VerifyBot",
        "student_class": "Class 10",
        "subject": "Physics",
        "book_id": "test_book_123",
        "book_name": "Test Physics Book",
        "score": 8,
        "total_questions": 10,
        "questions": [
            {"question": "What is gravity?", "user_answer": 1, "correct_index": 1, "options": ["A", "B"], "explanation": "It pulls down."}
        ]
    }
    
    # 2. Save Progress
    print("💾 Testing /api/progress/save...")
    try:
        res = requests.post(f"{BASE_URL}/api/progress/save", json=payload)
        if res.status_code == 200:
            print(f"✅ Save Successful: {res.json()}")
        else:
            print(f"❌ Save Failed: {res.status_code} - {res.text}")
            return
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    # 3. Retrieve History
    print("aaa Testing /api/progress/history...")
    try:
        time.sleep(1) # Ensure write persistence
        res = requests.get(f"{BASE_URL}/api/progress/history?student_name=VerifyBot&student_class=Class 10")
        if res.status_code == 200:
            history = res.json()
            print(f"✅ History Retrieved: {len(history)} items")
            
            # 4. Verify Content
            found = False
            for item in history:
                if item['book_id'] == "test_book_123" and item['score'] == 8:
                    found = True
                    print(f"✅ Verified Saved Attempt: {item['id']}")
                    break
            
            if not found:
                print("❌ Saved attempt NOT found in history.")
        else:
            print(f"❌ History Fetch Failed: {res.status_code} - {res.text}")
            
    except Exception as e:
        print(f"❌ Connection Error (History): {e}")

if __name__ == "__main__":
    test_progress_tracking()
