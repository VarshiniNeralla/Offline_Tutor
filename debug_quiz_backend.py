import sys
import traceback
import json
import time
from tutor_backend_multilingual import AITextbookTutorMultilingualBackendOffline

# Redirect stdout to capture everything
output_log = []

def log(msg):
    print(msg)
    output_log.append(str(msg))

log("🚀 Initializing Backend for Debug...")
try:
    # Initialize with a dummy language to avoid TTS if possible, or just ignore errors
    backend = AITextbookTutorMultilingualBackendOffline(language='english')
    
    log("\n--------------------------")
    log("🧩 Testing generate_quiz_response...")
    
    start_time = time.time()
    
    # Simulate a request for 5 questions
    response, sources, mode = backend.get_response(
        question="Generate 5 multiple choice questions about oceans or geography.",
        selected_subjects=[],
        selected_books=[],
        mode="quiz"
    )
    
    duration = time.time() - start_time
    log(f"\n✅ Success! Mode: {mode}")
    log(f"⏱️ Duration: {duration:.2f}s")
    
    # Save results to file
    result = {
        "success": True,
        "mode": mode,
        "duration": duration,
        "response": json.loads(response) if mode == "quiz" else response,
        "logs": output_log
    }
    
    with open('debug_output.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    log("📁 Results saved to debug_output.json")

except Exception as e:
    log("\n❌ CRASHED:")
    log(traceback.format_exc())
    with open('debug_output.json', 'w') as f:
        json.dump({"success": False, "error": str(e), "traceback": traceback.format_exc()}, f)

log("\nProcessing complete. Script will now exit.")
# Force exit to avoid pyttsx3 cleanup hang
sys.exit(0)
