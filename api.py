import os
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from contextlib import asynccontextmanager

# Import backend logic
from tutor_backend_multilingual import AITextbookTutorMultilingualBackend
from admin_backend import AITextbookAdminBackendOffline

# Global instances
tutor_backend = None
admin_backend = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global tutor_backend, admin_backend
    print("🚀 Starting Offline Neural Server...")
    
    # Initialize backends
    tutor_backend = AITextbookTutorMultilingualBackend(language='english') 
    admin_backend = AITextbookAdminBackendOffline()
    
    # Skip warmup - will warm on first request
    print("✅ Neural Core ready (warmup on first request)")
        
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

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    subjects: List[str]
    book_ids: Optional[List[str]] = None
    language: str
    mode: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
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

# --- Routes ---

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "llm": tutor_backend.llm_available if tutor_backend else False,
        "model": getattr(tutor_backend, 'model_name', "Unknown") if tutor_backend else "Unknown"
    }

@app.post("/api/chat")
async def chat(request: ChatRequest):
    print(f"📥 Received /api/chat request: mode={request.mode}, message={request.message[:50]}")
    
    if not tutor_backend:
        raise HTTPException(status_code=503, detail="System initializing")
    
    try:
        # Switch language if needed (this might need optimization to avoid reloading heavy models)
        if tutor_backend.language != request.language:
            print(f"🔄 Switching language to {request.language}")
            tutor_backend.language = request.language
            if request.language == 'telugu' and not hasattr(tutor_backend, 'whisper_model'):
                 tutor_backend.setup_telugu_asr_offline()
            tutor_backend.setup_offline_tts()

        print(f"🔄 Calling tutor_backend.get_response with mode={request.mode}")
        response_text, sources, mode = tutor_backend.get_response(
            request.message, 
            selected_subjects=request.subjects,
            selected_books=request.book_ids,
            mode=request.mode
        )
        
        print(f"✅ Got response, mode={mode}, response length={len(response_text)}")
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

@app.post("/api/upload")
async def upload_textbook(
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
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
