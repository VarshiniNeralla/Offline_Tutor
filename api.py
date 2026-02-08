import os
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
from contextlib import asynccontextmanager
import asyncio
import threading
import json
import io

# Import backend logic
from tutor_backend_multilingual import AITextbookTutorMultilingualBackend
from admin_backend import AITextbookAdminBackendOffline
from progress_manager import ProgressManager
from chat_manager import ChatManager
from tts_manager import TTSManager

# Global instances
tutor_backend = None
admin_backend = None
progress_manager = ProgressManager()
chat_manager = ChatManager()
tts_manager = TTSManager()
oral_review_queue = asyncio.Queue()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global tutor_backend, admin_backend
    print("🚀 Starting Offline Neural Server...")
    
    # Initialize backends
    tutor_backend = AITextbookTutorMultilingualBackend(language='english') 
    admin_backend = AITextbookAdminBackendOffline()
    
    # Start background worker for Oral Reviews
    asyncio.create_task(process_oral_reviews())
    print("✅ Oral Review Background Worker started")
    
    yield
    # Shutdown logic if needed
    print("👋 Shutting down Neural Server...")

app = FastAPI(title="AI Tutor Offline API", lifespan=lifespan)

# CORS - Allow local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For offline local use, allowing all is fine.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"📡 {request.method} {request.url}")
    response = await call_next(request)
    return response

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    subjects: List[str]
    book_ids: Optional[List[str]] = None
    language: str
    mode: Optional[str] = None

from typing import List, Optional, Dict, Any, Union

class ChatResponse(BaseModel):
    response: Union[str, Dict, List]
    sources: List[str]
    audio_base64: Optional[str] = None # We will send audio as base64 if needed

class StatsResponse(BaseModel):
    total_textbooks: int
    total_pages: int
    vectorstore_ready: bool
    languages: dict

class RenameRequest(BaseModel):
    book_id: str
    new_name: str

class ProgressRequest(BaseModel):
    type: str # 'quiz' or 'truefalse'
    student_name: str
    student_class: str
    subject: str
    book_id: str
    book_name: str
    score: int
    total_questions: int
    questions: Optional[List[dict]] = None
    metadata: Optional[dict] = None

class OralTestStartRequest(BaseModel):
    book_id: str
    book_name: str
    q_count: int
    mode: str  # 'practice' or 'test'
    student_name: str
    student_class: str
    subject: str
    language: str

class OralReviewRequest(BaseModel):
    attempt_id: str
    feedback_data: Dict[str, dict] # { q_index_str: { score, feedback } }

# --- Routes ---

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "llm": tutor_backend.llm_available if tutor_backend else False,
        "model": getattr(tutor_backend, 'model_name', "Unknown") if tutor_backend else "Unknown"
    }

@app.post("/api/chat")
def chat(request: ChatRequest):
    print(f"📬 Received /api/chat request: mode={request.mode}, message={request.message[:60]}...")
    
    if not tutor_backend:
        raise HTTPException(status_code=503, detail="System initializing")
    
    try:
        # Map language codes to full names for backend compatibility
        language_map = {
            'en': 'english',
            'te': 'telugu',
            'hi': 'hindi',
            'ta': 'tamil',
            'kn': 'kannada'
        }
        backend_language = language_map.get(request.language, request.language)

        # Switch language if needed (this might need optimization to avoid reloading heavy models)
        if hasattr(tutor_backend, 'language') and tutor_backend.language != backend_language:
            print(f"🔄 Switching language to {backend_language}")
            tutor_backend.language = backend_language
            if backend_language == 'telugu' and not hasattr(tutor_backend, 'whisper_model'):
                 tutor_backend.setup_telugu_asr_offline()
            tutor_backend.setup_offline_tts()

        print(f"🔁 Calling tutor_backend.get_response with mode={request.mode}")
        response_text, sources, mode = tutor_backend.get_response(
            request.message, 
            selected_subjects=request.subjects,
            selected_books=request.book_ids,
            mode=request.mode
        )
        
        print(f"📥 Got response, mode={mode}, response length={len(response_text)}")
        return {
            "response": response_text,
            "sources": sources,
            "mode": mode
        }
    except Exception as e:
        import traceback
        print("❌ ERROR IN /api/chat:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    if not admin_backend:
        raise HTTPException(status_code=503, detail="System initializing")
    return admin_backend.get_system_stats()

@app.post("/api/transcribe")
async def transcribe_generated_audio(file: UploadFile = File(...), language: str = Form(default='english')):
    """Generic endpoint for transcribing audio (STT) with language support"""
    if not tutor_backend:
        raise HTTPException(status_code=503, detail="System initializing")

    try:
        # Map language codes to full names for backend compatibility
        language_map = {
            'en': 'english',
            'te': 'telugu',
            'hi': 'hindi',
            'ta': 'tamil',
            'kn': 'kannada'
        }
        backend_language = language_map.get(language, language)

        # Switch language if needed
        if hasattr(tutor_backend, 'language') and tutor_backend.language != backend_language:
            print(f"🔄 Switching transcription language to {backend_language}")
            tutor_backend.language = backend_language
            # Re-setup ASR if Telugu is selected and not already set up
            if backend_language == 'telugu' and not hasattr(tutor_backend, 'whisper_model'):
                tutor_backend.setup_asr_offline()

        # Read file into BytesIO
        audio_content = await file.read()
        import io
        audio_file = io.BytesIO(audio_content)

        # Transcribe
        text = tutor_backend.transcribe_audio(audio_file)

        # Check for error prefixes from backend
        if text.startswith("❌"):
             raise HTTPException(status_code=500, detail=text)

        return {"text": text}
    except Exception as e:
        print(f"❌ Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class TTSRequest(BaseModel):
    text: str
    language: str = "english"

@app.post("/api/tts")
def text_to_speech(request: TTSRequest):
    """Generic endpoint for Text-to-Speech (TTS) using Dedicated Worker"""
    # Use the dedicated TTS manager
    audio_path = tts_manager.generate_audio(request.text, request.language)
    
    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(status_code=500, detail="TTS generation failed")
        
    # Read bytes to memory so we can delete file
    with open(audio_path, 'rb') as f:
        audio_data = io.BytesIO(f.read())
        
    # Cleanup temp file
    try:
        os.unlink(audio_path)
    except:
        pass
        
    # Return as streaming response
    return StreamingResponse(audio_data, media_type="audio/wav")


# --- Chat History Endpoints ---

@app.get("/api/chats")
async def get_all_chats(student_name: Optional[str] = None):
    # Pass the student name filter to the manager
    return chat_manager.get_all_chats(student_name)

@app.post("/api/chats/save")
async def save_chat_endpoint(chat: Dict):
    # Determine if it's a full list or single chat
    # Frontend logic seems to handle individual chats better, but let's see.
    # We'll support saving a single chat object.
    chat_manager.sync_chat_state(chat)
    return {"status": "success"}

@app.delete("/api/chats/{chat_id}")
async def delete_chat_endpoint(chat_id: str):
    chat_manager.delete_chat(chat_id)
    return {"status": "success"}

@app.post("/api/upload")
def upload_textbook(
    file: UploadFile = File(...), 
    language: str = Form("english"),
    subject_name: str = Form(...),
    class_name: str = Form("Unassigned"),
    auto_detect: bool = Form(False)
):
    print(f"📡 Incoming upload request: {file.filename} ({subject_name})")
    
    if not admin_backend:
        print("❌ Backend not initialized")
        raise HTTPException(status_code=503, detail="System initializing")

    try:
        # Use the underlying SpooledTemporaryFile directly for streaming
        # FastAPI handles the upload and stores it in a temp file if it's large
        file_obj = file.file
        
        print(f"🔍 Processing file: {file.filename}, auto_detect={auto_detect}")
        
        if auto_detect:
            print("🕵️ Detecting language...")
            detected_lang, _ = admin_backend.detect_pdf_language(file_obj)
            file_obj.seek(0)
            params_lang = detected_lang
            print(f"🌐 Detected language: {params_lang}")
        else:
            params_lang = language

        print("🚀 Handing off to admin_backend.add_textbook...")
        success, message = admin_backend.add_textbook(
            file_obj, 
            subject_name=subject_name,
            language=params_lang, 
            class_name=class_name, 
            auto_detected=auto_detect,
            original_filename=file.filename
        )
            
        print(f"🏁 Upload result: success={success}, message={message}")
        if success:
            return {"status": "success", "message": message}
        else:
             raise HTTPException(status_code=400, detail=message)
             
    except Exception as e:
        import traceback
        print("❌ CRITICAL ERROR IN /api/upload:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.delete("/api/textbook/{book_id}")
async def delete_textbook(book_id: str):
    if not admin_backend:
         raise HTTPException(status_code=503, detail="System initializing")
    
    success, message = admin_backend.remove_textbook(book_id)
    if success:
        return {"status": "success", "message": message}
    raise HTTPException(status_code=400, detail=message)

@app.patch("/api/textbook/rename")
async def rename_textbook_endpoint(request: RenameRequest):
    print(f"🔄 Rename request: ID={request.book_id}, New Name={request.new_name}")
    if not admin_backend:
        print("❌ Backend not initialized")
        raise HTTPException(status_code=503, detail="System initializing")
    
    success, message = admin_backend.rename_textbook(request.book_id, request.new_name)
    print(f"🏁 Rename result: {success}, {message}")
    if success:
         return {"status": "success", "message": message}
    raise HTTPException(status_code=400, detail=message)

# --- Progress Endpoints ---

@app.post("/api/progress/save")
async def save_progress_record(request: ProgressRequest):
    print(f"📊 Saving progress for {request.student_name} ({request.type})")
    try:
        attempt_id = progress_manager.save_progress(request.model_dump())
        return {"status": "success", "attempt_id": attempt_id}
    except Exception as e:
        print(f"❌ Failed to save progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/progress/history")
async def get_progress_history(name: str, student_class: str):
    print(f"📜 Fetching history for {name} ({student_class})")
    try:
        history = progress_manager.get_history(student_name=name, student_class=student_class)
        return history
    except Exception as e:
        print(f"❌ Failed to fetch history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Oral Test Specific Endpoints ---

@app.post("/api/oral_test/start")
async def start_oral_test(request: OralTestStartRequest):
    print(f"🎙️ Starting {request.mode} Oral Test for {request.student_name}...")

    if not tutor_backend:
        raise HTTPException(status_code=503, detail="System initializing")

    try:
        # Map language codes to full names for backend compatibility
        language_map = {
            'en': 'english',
            'te': 'telugu',
            'hi': 'hindi',
            'ta': 'tamil',
            'kn': 'kannada'
        }
        backend_language = language_map.get(request.language, request.language)

        # Switch language if needed
        if tutor_backend.language != backend_language:
            print(f"🔄 Switching language for Oral Test to {backend_language}")
            tutor_backend.language = backend_language
            if backend_language == 'telugu' and not hasattr(tutor_backend, 'whisper_model'):
                 tutor_backend.setup_telugu_asr_offline()
            tutor_backend.setup_offline_tts()

        # 1. Generate Questions
        prompt = f"Generate {request.q_count} oral test questions for {request.book_name}"
        questions, _, _ = tutor_backend.generate_oral_test_response(
            prompt, 
            selected_books=[request.book_id],
            selected_subjects=[request.subject]
        )
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate questions")

        # 2. Create Initial Progress Record
        record = {
            "type": "oral_test",
            "student_name": request.student_name,
            "student_class": request.student_class,
            "subject": request.subject,
            "book_id": request.book_id,
            "book_name": request.book_name,
            "score": 0,
            "total_questions": len(questions),
            "status": "IN_PROGRESS",
            "metadata": {
                "mode": request.mode,
                "questions": questions, # includes canonical sample_answers
                "start_time": os.popen('date /t').read().strip() # Simple timestamp
            }
        }
        
        attempt_id = progress_manager.save_progress(record)
        return {"status": "success", "attempt_id": attempt_id, "questions": questions}
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/oral_answers/upload")
async def upload_oral_answer(
    attempt_id: str = Form(...),
    question_index: int = Form(...),
    audio: UploadFile = File(...)
):
    print(f"🎤 Uploading audio for attempt {attempt_id}, question {question_index}")
    
    try:
        # 1. Save File
        upload_dir = os.path.join("data", "oral_tests", attempt_id)
        os.makedirs(upload_dir, exist_ok=True)
        
        file_ext = audio.filename.split(".")[-1] if "." in audio.filename else "webm"
        file_path = os.path.join(upload_dir, f"q_{question_index}.{file_ext}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
            
        # 2. Update Progress Metadata
        history = progress_manager._get_all_history()
        for record in history:
            if record.get("attempt_id") == attempt_id:
                if "questions" in record["metadata"]:
                    # Relative URL for the frontend
                    record["metadata"]["questions"][question_index]["audio_url"] = f"/api/oral_audio/{attempt_id}/q_{question_index}.{file_ext}"
                break
        
        # Save back to disk
        with open(progress_manager.storage_path, "w", encoding="utf-8") as f:
            import json
            json.dump(history, f, indent=4, ensure_ascii=False)
            
        return {"status": "success", "audio_url": f"/api/oral_audio/{attempt_id}/q_{question_index}.{file_ext}"}
        
    except Exception as e:
        print(f"❌ Audio upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/oral_audio/{attempt_id}/{filename}")
async def get_oral_audio(attempt_id: str, filename: str):
    file_path = os.path.join("data", "oral_tests", attempt_id, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(file_path)

@app.get("/api/oral_answers/list_pending")
async def list_pending_reviews():
    """Lists all oral tests that are finished but not reviewed."""
    history = progress_manager._get_all_history()
    pending = [r for r in history if r.get("type") == "oral_test" and r.get("status") in ["PENDING_REVIEW", "AI_REVIEWED", "AI_REVIEW_FAILED"]]
    return pending

@app.post("/api/oral_test/review")
async def submit_oral_review(request: OralReviewRequest):
    print(f"📝 Reviewing attempt {request.attempt_id}")
    try:
        history = progress_manager._get_all_history()
        total_score = 0
        found = False
        
        for record in history:
            if record.get("attempt_id") == request.attempt_id:
                found = True
                # feedback_data is { index: { score, feedback } }
                for q_idx_str, data in request.feedback_data.items():
                    idx = int(q_idx_str)
                    if idx < len(record["metadata"]["questions"]):
                        record["metadata"]["questions"][idx]["score"] = data.get("score", 0)
                        record["metadata"]["questions"][idx]["feedback"] = data.get("feedback", "")
                        total_score += data.get("score", 0)
                
                record["score"] = total_score
                record["status"] = "REVIEWED"
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Attempt not found")
            
        # Save back
        with open(progress_manager.storage_path, "w", encoding="utf-8") as f:
            import json
            json.dump(history, f, indent=4, ensure_ascii=False)
            
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Review submission failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/oral_test/finish/{attempt_id}")
async def finish_oral_test(attempt_id: str):
    """Marks an in-progress oral test as pending review and triggers AI review queue."""
    try:
        history = progress_manager._get_all_history()
        for record in history:
            if record.get("attempt_id") == attempt_id:
                record["status"] = "PENDING_REVIEW"
                break
        
        with open(progress_manager.storage_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4, ensure_ascii=False)
            
        # Add to background processing queue
        await oral_review_queue.put(attempt_id)
        print(f"📥 Added attempt {attempt_id} to Oral Review queue")
        
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Error finishing oral test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_oral_reviews():
    """Background worker that transcribes and analyzes oral tests one by one."""
    print("🤖 Oral Review Worker: Waiting for tasks...")
    while True:
        attempt_id = await oral_review_queue.get()
        print(f"🤖 Processing Oral Review for attempt: {attempt_id}")
        
        try:
            # 1. Fetch record
            history = progress_manager._get_all_history()
            record = next((r for r in history if r.get("attempt_id") == attempt_id), None)
            
            if not record or record.get("type") != "oral_test":
                print(f"⚠️ Invalid record for attempt {attempt_id}")
                oral_review_queue.task_done()
                continue

            # 2. Process each question
            questions = record["metadata"].get("questions", [])
            any_success = False
            
            for i, q in enumerate(questions):
                audio_rel_url = q.get("audio_url")
                if not audio_rel_url:
                    continue
                
                # Convert rel URL to local path
                # URL is /api/oral_audio/{attempt_id}/q_{index}.{ext}
                filename = audio_rel_url.split("/")[-1]
                audio_path = os.path.join("data", "oral_tests", attempt_id, filename)
                
                if not os.path.exists(audio_path):
                    print(f"⚠️ Audio file missing: {audio_path}")
                    continue
                
                # A. Transcribe
                transcript, error = tutor_backend.transcribe_file(audio_path)
                if error:
                    print(f"❌ Transcription failed for Q{i}: {error}")
                    q["transcript"] = f"[Error: {error}]"
                    continue
                
                q["transcript"] = transcript
                
                # B. Analyze (AI Feedback) - Retry once if it fails to get a good response
                analysis = tutor_backend.analyze_oral_transcript(q["question"], q["sample_answer"], transcript)
                if analysis.get('score') == 0 and "error" in analysis.get('feedback', '').lower():
                    print(f"🔄 Retrying AI Analysis for Q{i}...")
                    analysis = tutor_backend.analyze_oral_transcript(q["question"], q["sample_answer"], transcript)
                
                q["ai_analysis"] = analysis
                any_success = True
                print(f"✅ AI Review completed for Q{i} (Score: {analysis['score']})")

            # 3. Update Status and Save
            if any_success:
                record["status"] = "AI_REVIEWED"
                record["metadata"]["ai_reviewed"] = True
                # Calculate total AI score and sync question count
                questions_list = record["metadata"]["questions"]
                total_ai_score = sum(q.get("ai_analysis", {}).get("score", 0) for q in questions_list)
                record["score"] = total_ai_score
                record["total_questions"] = len(questions_list)
            else:
                record["status"] = "AI_REVIEW_FAILED"
                record["metadata"]["ai_review_error"] = "No audio files could be processed."

            with open(progress_manager.storage_path, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=4, ensure_ascii=False)
                
            print(f"🤖 Finished background processing for {attempt_id}")

        except Exception as e:
            print(f"❌ Critical error in Oral Review Worker: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            oral_review_queue.task_done()

@app.get("/api/textbooks")
async def list_textbooks():
     if not admin_backend:
         return {}
     # Return the dictionary of books keyed by ID, or list values if frontend prefers list
     return admin_backend.textbooks

@app.get("/api/book/{book_id}")
async def get_book_file(book_id: str):
    if not admin_backend:
        raise HTTPException(status_code=503, detail="System initializing")
    
    if book_id not in admin_backend.textbooks:
        raise HTTPException(status_code=404, detail="Book not found")
        
    book = admin_backend.textbooks[book_id]
    file_path = book['file_path']
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(file_path, media_type='application/pdf', filename=book['file_name'])

# Static Files (React Build)
# We will check if the build folder exists and mount it
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
