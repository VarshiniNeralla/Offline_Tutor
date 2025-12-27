import os
import json
import warnings
import uuid
import shutil
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langdetect import detect
import requests

warnings.filterwarnings('ignore')

class AITextbookAdminBackendOffline:
    def __init__(self):
        print("🚀 Initializing Offline Admin Backend...")
        self.textbooks = {} # Stored as {book_id: {metadata}}
        self.vectorstore = None
        self.setup_embeddings_offline()
        self.check_llama_offline()
        self.load_existing_data()
        print("✅ Offline Admin Backend Ready!")
    
    def setup_embeddings_offline(self):
        """Setup embeddings with offline mode"""
        print("🧠 Setting up offline embeddings...")
        try:
            os.makedirs("./models/embeddings", exist_ok=True)
            os.environ['HF_HUB_OFFLINE'] = '1'
            os.environ['TRANSFORMERS_OFFLINE'] = '1'
            
            try:
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2",
                    model_kwargs={'device': 'cpu', 'local_files_only': True},
                    cache_folder="./models/embeddings"
                )
                print("✅ Offline embeddings loaded from cache!")
            except Exception as offline_error:
                print(f"⚠️ Offline mode failed: {offline_error}")
                raise Exception("Models not available offline. Run download_models.py first with internet connection.")
                
        except Exception as e:
            print(f"❌ Embeddings setup failed: {e}")
            raise e

    def check_llama_offline(self):
        """Check Ollama availability with memory-safe fallback order"""
        print("🤖 Checking local AI availability...")
        # Consistent with tutor backend for 8GB RAM stability
        fallback_order = ['phi3', 'phi', 'llama3.2', 'llama3.1', 'mistral', 'llama3']
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=3)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]
                
                selected_model = None
                for candidate in fallback_order:
                    # Find matching model with its full tag
                    match = next((name for name in model_names if candidate in name), None)
                    if match:
                        selected_model = match
                        break
                
                if selected_model:
                    self.llm_available = True
                    self.model_name = selected_model
                    print(f"✅ Local AI ready: {selected_model}")
                elif models:
                    self.llm_available = True
                    self.model_name = model_names[0]['name'].split(':')[0]
                    print(f"✅ Local AI ready (fallback): {self.model_name}")
                else:
                    self.llm_available = False
                    print("⚠️ Ollama running but no models found")
            else:
                self.llm_available = False
                print("⚠️ Ollama not responding properly")
        except:
            self.llm_available = False
            print("⚠️ Ollama not running - Admin functions will work without AI")
    
    def load_existing_data(self):
        """Load existing textbook metadata (fully offline)"""
        print("📂 Loading existing data...")
        if os.path.exists("textbook_metadata.json"):
            try:
                with open("textbook_metadata.json", 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Migration check: if data is keyed by subject name (old format), clear it or migrate
                    # For safety in this task, if it looks like old format, we start fresh to avoid crashes
                    # Old format: { "Subject": { ... } }
                    # New format: { "uuid": { "book_id": "...", ... } }
                    first_key = next(iter(data)) if data else None
                    if first_key and not self._is_valid_uuid(first_key):
                         print("⚠️ Detected old metadata format. Starting fresh to ensure compatibility.")
                         self.textbooks = {}
                    else:
                        self.textbooks = data
                print(f"📚 Loaded metadata for {len(self.textbooks)} textbooks")
            except Exception as e:
                print(f"⚠️ Error loading metadata: {e}")
                self.textbooks = {}
        
        # Load existing vectorstore
        if os.path.exists("./ai_tutor_db"):
            try:
                self.vectorstore = Chroma(
                    persist_directory="./ai_tutor_db",
                    embedding_function=self.embeddings
                )
                print("✅ Existing vector database loaded!")
            except Exception as e:
                print(f"⚠️ Could not load existing database: {e}")
                self.vectorstore = None
    
    def _is_valid_uuid(self, val):
        try:
            uuid.UUID(str(val))
            return True
        except ValueError:
            return False

    def save_metadata(self):
        """Save textbook metadata to JSON file"""
        with open("textbook_metadata.json", 'w', encoding='utf-8') as f:
            json.dump(self.textbooks, f, indent=2, ensure_ascii=False)
        print("💾 Metadata saved locally")
    
    def detect_pdf_language_offline(self, pdf_file):
        """Offline language detection from PDF content"""
        temp_path = "temp_detect.pdf"
        try:
            with open(temp_path, "wb") as f:
                f.write(pdf_file.getvalue())
            
            loader = PyPDFLoader(temp_path)
            pages = loader.load()
            
            sample_text = ""
            for page in pages[:3]:
                if len(page.page_content.strip()) > 50:
                    sample_text += page.page_content[:1000] + " "
                    if len(sample_text) > 2000: break
            
            if len(sample_text.strip()) < 50:
                return "english", 0.5
            
            detected_lang = detect(sample_text)
            language_map = {'te': 'telugu', 'en': 'english', 'hi': 'hindi'}
            return language_map.get(detected_lang, 'english'), 0.85
            
        except Exception as e:
            print(f"❌ Language detection failed: {e}")
            return "english", 0.5
        finally:
            if os.path.exists(temp_path): os.remove(temp_path)
    
    def add_textbook_offline(self, file_obj, subject_name: str, language: str, class_name: str = "Unassigned", auto_detected=False, original_filename: str = None):
        """Add textbook with streaming support and robust error handling"""
        print(f"📥 Starting upload: {subject_name} for {class_name}")
        
        try:
            # 1. Generate ID and Paths
            book_id = str(uuid.uuid4())
            
            # Sanitize filename
            if not original_filename:
                original_filename = getattr(file_obj, 'name', 'unknown.pdf')
            
            # Clean up the name
            safe_filename = "".join([c for c in os.path.basename(original_filename) if c.isalnum() or c in "._- "])
            if not safe_filename: safe_filename = f"book_{book_id[:8]}.pdf"
            if not safe_filename.lower().endswith('.pdf'): safe_filename += '.pdf'
            
            # library/Class/Subject/filename.pdf
            base_dir = "library"
            class_dir = "".join([c for c in class_name if c.isalnum()])
            subject_dir = "".join([c for c in subject_name if c.isalnum()])
            
            save_dir = os.path.join(base_dir, class_dir, subject_dir)
            os.makedirs(save_dir, exist_ok=True)
            
            file_path = os.path.join(save_dir, safe_filename)
            
            print(f"📂 Saving file to: {file_path}")
            
            # 2. Save File (Streaming)
            with open(file_path, "wb") as f:
                if hasattr(file_obj, 'read'):
                    shutil.copyfileobj(file_obj, f)
                else:
                    f.write(file_obj) # Fallback if it's bytes
            
            print(f"📄 File saved. Loading PDF content...")
            
            # 3. Process Content (Loader -> Split -> Embed)
            if not os.path.exists(file_path):
                return False, f"❌ Failed to save file at {file_path}"

            loader = PyPDFLoader(file_path)
            try:
                pages = loader.load()
            except Exception as pdf_err:
                print(f"❌ PDF Loading error: {pdf_err}")
                return False, f"❌ PDF Loading error: {str(pdf_err)}"
            
            if not pages:
                print("⚠️ PDF has no pages")
                return False, "❌ Empty PDF"
            
            print(f"📝 Extracted {len(pages)} pages. Preparing chunks...")
            
            # Enrich Metadata
            for page in pages:
                page.metadata.update({
                    "book_id": book_id,
                    "subject": subject_name,
                    "language": language,
                    "class": class_name
                })
            
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            text_pages = [p for p in pages if len(p.page_content.strip()) > 50] # Lowered limit slightly
            
            if not text_pages:
                print("⚠️ No readable text found in PDF")
                return False, "❌ No text content found (is the PDF a scanned image without OCR?)"
            
            chunks = text_splitter.split_documents(text_pages)
            print(f"🔗 Created {len(chunks)} chunks. Updating vector store...")
            
            # 4. Vector Store
            try:
                if self.vectorstore is None:
                    print("🆕 Creating new vector store...")
                    self.vectorstore = Chroma.from_documents(chunks, self.embeddings, persist_directory="./ai_tutor_db")
                else:
                    print("➕ Adding to existing vector store...")
                    self.vectorstore.add_documents(chunks)
                print("✅ Vector store updated successfully")
            except Exception as ve:
                print(f"❌ Vector Store Error: {ve}")
                return False, f"❌ Database error: {str(ve)}"
            
            # 5. Store Metadata
            self.textbooks[book_id] = {
                'book_id': book_id,
                'file_name': safe_filename,
                'subject_name': subject_name,
                'class_name': class_name,
                'language': language,
                'file_path': file_path,
                'pages': len(text_pages),
                'chunks': len(chunks),
                'auto_detected': auto_detected
            }
            
            self.save_metadata()
            print(f"🎉 Successfully added {subject_name} ({safe_filename})")
            return True, f"✅ Added {safe_filename} to {subject_name}"
            
        except Exception as e:
            import traceback
            print("❌ UNCAUGHT EXCEPTION IN BACKEND:")
            traceback.print_exc()
            return False, f"Critical System Error: {str(e)}"

    def rename_textbook(self, book_id, new_name):
        """Rename the textbook file and update metadata"""
        print(f"📂 Backend rename started: {book_id} -> {new_name}")
        
        if book_id not in self.textbooks:
            print(f"❌ ID {book_id} not found in {list(self.textbooks.keys())}")
            return False, "Book ID not found"
        
        # Sanitize new_name (remove invalid path characters)
        safe_name = "".join([c for c in new_name if c.isalnum() or c in "._- "])
        if not safe_name: safe_name = f"renamed_{book_id[:8]}"
        
        if not safe_name.lower().endswith('.pdf'):
            safe_name += '.pdf'
            
        book = self.textbooks[book_id]
        old_path = book['file_path']
        dir_name = os.path.dirname(old_path)
        new_path = os.path.join(dir_name, safe_name)
        
        print(f"🚛 Moving: {old_path} -> {new_path}")
        
        try:
            if not os.path.exists(old_path):
                print(f"⚠️ Source file missing: {old_path}")
                # We update the metadata anyway if it's just a file mismatch? 
                # No, better return error so user knows.
                return False, f"Source file not found at {old_path}"

            if os.path.exists(new_path) and old_path.lower() != new_path.lower():
                print(f"⚠️ Destination exists: {new_path}")
                return False, "A file with this name already exists"

            os.rename(old_path, new_path)
            
            book['file_name'] = safe_name
            book['file_path'] = new_path
            self.save_metadata()
            print("✅ Rename successful")
            return True, f"Renamed to {safe_name}"
        except Exception as e:
            import traceback
            traceback.print_exc()
            return False, f"Rename failed: {str(e)}"

    def remove_textbook(self, book_id):
        """Remove textbook by ID"""
        if book_id in self.textbooks:
            book = self.textbooks[book_id]
            file_path = book['file_path']
            
            # Try to delete file
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"⚠️ Could not delete file {file_path}: {e}")
            
            del self.textbooks[book_id]
            self.save_metadata()
            return True, "Textbook removed"
        return False, "Book not found"
    
    def get_system_stats(self):
        if not self.textbooks:
            return {
                'total_textbooks': 0, 'total_pages': 0, 
                'vectorstore_ready': False, 'languages': {}
            }
        
        total_pages = sum(b['pages'] for b in self.textbooks.values())
        langs = {}
        for b in self.textbooks.values():
            l = b['language']
            langs[l] = langs.get(l, 0) + 1
            
        return {
            'total_textbooks': len(self.textbooks),
            'total_pages': total_pages,
            'vectorstore_ready': self.vectorstore is not None,
            'languages': langs
        }

    # Wrapper methods
    def detect_pdf_language(self, pdf_file):
        return self.detect_pdf_language_offline(pdf_file)
    
    def add_textbook(self, pdf_file, subject_name, language, class_name, auto_detected, original_filename=None):
        return self.add_textbook_offline(pdf_file, subject_name, language, class_name, auto_detected, original_filename=original_filename)
