import requests
import json

url = "http://localhost:8000/api/chat"

# Get list of textbooks first
try:
    books_res = requests.get("http://localhost:8000/api/textbooks")
    books = books_res.json()
    
    if books:
        # Get first book
        first_book = list(books.values())[0]
        book_id = first_book['book_id']
        subject = first_book.get('subject_name', 'Science')
        
        print(f"Using book: {first_book.get('file_name', 'Unknown')}")
        print(f"Book ID: {book_id}")
        print(f"Subject: {subject}")
        
        payload = {
            "message": "Generate 10 multiple choice questions for a quiz.",
            "subjects": [subject],
            "book_ids": [book_id],
            "language": "english",
            "mode": "quiz"
        }
    else:
        print("⚠️ No textbooks found, using empty lists")
        payload = {
            "message": "Generate 10 multiple choice questions for a quiz.",
            "subjects": [],
            "book_ids": [],
            "language": "english",
            "mode": "quiz"
        }
        
except Exception as e:
    print(f"Failed to get textbooks: {e}")
    payload = {
        "message": "Generate 10 multiple choice questions for a quiz.",
        "subjects": [],
        "book_ids": [],
        "language": "english",
        "mode": "quiz"
    }

print("\n📡 Sending request to /api/chat...")
try:
    response = requests.post(url, json=payload, timeout=60)
    print(f"Status Code: {response.status_code}")
    print(f"\nResponse Headers: {dict(response.headers)}")
    print(f"\nResponse Body:")
    print(response.text)
    
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"\n✅ Parsed JSON successfully")
            print(f"Mode: {data.get('mode')}")
            print(f"Response preview: {data.get('response', '')[:200]}")
        except:
            print("❌ Failed to parse JSON")
    
except requests.exceptions.Timeout:
    print("⏱️ Request timed out")
except Exception as e:
    print(f"❌ Request failed: {e}")
