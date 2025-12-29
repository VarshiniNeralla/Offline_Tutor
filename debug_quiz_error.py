import requests
import json

url = "http://localhost:8000/api/chat"
payload = {
    "message": "Generate 10 multiple choice questions for a quiz.",
    "subjects": ["Science"],
    "book_ids": ["some-book-id"],
    "language": "english",
    "mode": "quiz"
}

try:
    print(f"📡 Sending request to {url}...")
    response = requests.post(url, json=payload, timeout=30)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Response:")
        print(response.text[:500])
    else:
        print("❌ Error Response:")
        print(response.text)
except Exception as e:
    print(f"❌ Failed to connect: {e}")
