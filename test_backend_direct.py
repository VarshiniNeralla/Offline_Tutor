from tutor_backend_multilingual import AITextbookTutorMultilingualBackendOffline

print("🚀 Testing Backend Directly...")
backend = AITextbookTutorMultilingualBackendOffline(language='english')

print("\n📝 Testing quiz generation...")
try:
    response, sources, mode = backend.get_response(
        question="Generate 10 quiz questions about geography.",
        selected_subjects=["Social"],
        selected_books=["bdb1fde8-f1ea-4eff-9f12-ed2d4a2aaabc"],
        mode="quiz"
    )
    
    print(f"✅ Success!")
    print(f"Mode: {mode}")
    print(f"Response length: {len(response)}")
    print(f"Response preview: {response[:200]}")
    
except Exception as e:
    import traceback
    print(f"\n❌ Error: {e}")
    traceback.print_exc()
