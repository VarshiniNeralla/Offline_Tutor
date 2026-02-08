import os
import json
import warnings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
except ImportError:
    HuggingFaceEmbeddings = None
from langchain_community.vectorstores import Chroma
import requests

# Whisper for ASR - using OpenAI Whisper (best Telugu script accuracy)
try:
    import whisper  # OpenAI Whisper with GPU support
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    whisper = None
import torch
try:
    import pyttsx3
except ImportError:
    pyttsx3 = None
import tempfile
import io
import re
import time

# Translation support for Telugu
try:
    from deep_translator import GoogleTranslator
    TRANSLATOR_AVAILABLE = True
except ImportError:
    TRANSLATOR_AVAILABLE = False
    GoogleTranslator = None

warnings.filterwarnings('ignore')

import threading

class AITextbookTutorMultilingualBackendOffline:
    def __init__(self, language='telugu'):
        print(f"Initializing Offline AI Tutor ({language})...")
        self.language = language
        self.textbooks = {}
        self.vectorstore = None
        self.model_name = "qwen2.5:1.5b" # Default offline model
        self.setup_embeddings_offline()
        self.check_llama_offline()
        
        # Setup ASR for both English and Telugu
        self.setup_asr_offline()
        
        self.tts_lock = threading.Lock() # Lock for TTS
        self.setup_offline_tts()
        self.load_existing_data()
        print("Offline AI Tutor Ready!")
    
    def setup_embeddings_offline(self):
        """Setup embeddings with proper offline caching"""
        if HuggingFaceEmbeddings is None:
            print("Embeddings library (sentence-transformers) missing. RAG disabled.")
            self.embeddings = None
            return

        try:
            print("Ensuring embedding model is fully downloaded...")
            os.makedirs("./models/embeddings", exist_ok=True)
            
            # Set environment variables for offline mode
            os.environ['HF_HUB_OFFLINE'] = '1'
            os.environ['TRANSFORMERS_OFFLINE'] = '1'
            os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
            
            try:
                # First try to load in offline mode
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2",
                    model_kwargs={'device': 'cpu', 'local_files_only': True},
                    cache_folder="./models/embeddings"
                )
                print("Offline embeddings ready!")
                
            except Exception as offline_error:
                print(f"Offline mode failed: {offline_error}")
                
                # Remove offline mode temporarily to download
                if 'HF_HUB_OFFLINE' in os.environ:
                    del os.environ['HF_HUB_OFFLINE']
                if 'TRANSFORMERS_OFFLINE' in os.environ:
                    del os.environ['TRANSFORMERS_OFFLINE']
                
                print("📥 Downloading embedding model for offline use...")
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2",
                    model_kwargs={'device': 'cpu'},
                    cache_folder="./models/embeddings"
                )
                
                # Set offline mode back
                os.environ['HF_HUB_OFFLINE'] = '1'
                os.environ['TRANSFORMERS_OFFLINE'] = '1'
                
                print("✅ Embedding model downloaded and cached for offline use!")
                
        except Exception as e:
            print(f"Embeddings setup failed: {e}. RAG disabled.")
            self.embeddings = None
        
    def setup_asr_offline(self):
        """Setup Speech Recognition (ASR) using OpenAI Whisper with GPU support"""
        try:
            print(f"🎤 Starting Speech Recognition setup with OpenAI Whisper...")

            # Try to import OpenAI Whisper
            try:
                import whisper
                self.whisper_lib = whisper
                print("✅ OpenAI Whisper library available")
            except ImportError:
                print("❌ openai-whisper not installed. Run: pip install openai-whisper")
                self.asr_available = False
                self.asr_error = "openai-whisper not installed"
                return

            # Check GPU availability
            import torch
            self.has_cuda = torch.cuda.is_available()
            if self.has_cuda:
                print("🚀 GPU (CUDA) detected! Transcription will be much faster.")
            else:
                print("💻 Using CPU. Transcription will be slower but accurate.")

            # Set model name (will be loaded on first transcription)
            # Use 'large' model for Telugu transcription accuracy
            # 'large' is 1.5GB but provides much better Telugu transcription
            self.whisper_model_name = "large"
            self.whisper_model = None  # Lazy load on first use
            self.asr_available = True
            self.asr_error = None
            print(f"✅ ASR Ready! Will use '{self.whisper_model_name}' model (best for Telugu)")

        except Exception as e:
            print(f"❌ ASR setup completely failed: {e}")
            self.asr_available = False
            self.asr_error = f"Setup failed: {str(e)}"
    
    def setup_offline_tts(self):
        """Setup OFFLINE Text-to-Speech using pyttsx3 if available"""
        if pyttsx3 is None:
            print("⚠️ pyttsx3 not installed; offline TTS disabled.")
            self.tts_available = False
            return
            
        try:
            print("🔊 Setting up offline text-to-speech...")
            if pyttsx3 is None:
                print("pyttsx3 not installed. TTS disabled.")
                self.tts_engine = None
                return
            self.tts_engine = pyttsx3.init()
            
            # Configure TTS for Telugu/English
            voices = self.tts_engine.getProperty('voices')
            if voices:
                # Try to find appropriate voice
                for voice in voices:
                    if self.language == 'telugu' and ('telugu' in voice.name.lower() or 'te' in voice.id.lower()):
                        self.tts_engine.setProperty('voice', voice.id)
                        break
                    elif self.language == 'english' and 'en' in voice.id.lower():
                        self.tts_engine.setProperty('voice', voice.id)
                        break
                else:
                    # Use first available voice
                    self.tts_engine.setProperty('voice', voices[0].id)
            
            # Set speech properties
            self.tts_engine.setProperty('rate', 150)  # Speech rate
            self.tts_engine.setProperty('volume', 0.9)  # Volume
            
            self.tts_available = True
            print("✅ Offline Text-to-Speech Ready!")
        except Exception as e:
            print(f"❌ Offline TTS setup failed: {e}")
            self.tts_available = False

    def transcribe_audio(self, audio_file):
        """Multilingual transcription (STT) using OpenAI Whisper with GPU support"""
        if not self.asr_available:
            return f"❌ Speech recognition not available (Language: {self.language})"

        try:
            gpu_status = "GPU" if self.has_cuda else "CPU"
            print(f"🎤 Transcribing audio ({self.language}) with OpenAI Whisper ({gpu_status})...")

            # Save audio to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_file.getvalue())
                tmp_path = tmp_file.name

            # Load model if not already loaded (lazy loading)
            if self.whisper_model is None:
                model_name = getattr(self, 'whisper_model_name', 'large')
                print(f"🔄 Loading OpenAI Whisper {model_name} model...")
                self.whisper_model = self.whisper_lib.load_model(model_name)
                print(f"✅ OpenAI Whisper {model_name} model loaded!")

            # Transcribe with explicit language setting and GPU support
            if self.language == 'telugu':
                print("🔤 Transcribing in Telugu (te)...")
                result = self.whisper_model.transcribe(
                    tmp_path,
                    language="te",  # Explicit Telugu
                    task="transcribe",
                    verbose=False,
                    fp16=self.has_cuda  # Use FP16 if GPU available, otherwise FP32
                )
            else:  # English
                print("🔤 Transcribing in English (en)...")
                result = self.whisper_model.transcribe(
                    tmp_path,
                    language="en",
                    task="transcribe",
                    verbose=False,
                    fp16=self.has_cuda
                )

            transcribed_text = result["text"].strip()
            print(f"✅ Transcribed: {transcribed_text[:100]}...")

            # Validate script for Telugu
            if self.language == 'telugu' and transcribed_text:
                has_telugu = any('\u0c00' <= char <= '\u0c7f' for char in transcribed_text)
                has_devanagari = any('\u0900' <= char <= '\u097f' for char in transcribed_text)
                has_tamil = any('\u0b80' <= char <= '\u0bff' for char in transcribed_text)

                if has_devanagari:
                    print("❌ ERROR: Got Devanagari script instead of Telugu!")
                    return "⚠️ Could not recognize Telugu clearly. Please speak more clearly."
                elif has_tamil:
                    print("❌ ERROR: Got Tamil script instead of Telugu!")
                    return "⚠️ Speech detected as Tamil. Please ensure you selected Telugu language."
                elif not has_telugu:
                    print("⚠️ WARNING: No Telugu characters (might be English/numbers)")

            os.unlink(tmp_path)
            return transcribed_text

        except Exception as e:
            print(f"❌ Transcription error: {e}")
            import traceback
            traceback.print_exc()
            return f"❌ Transcription error: {str(e)}"

    def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text between languages using Google Translate"""
        if not TRANSLATOR_AVAILABLE:
            print("⚠️ Translation library not available")
            return text

        try:
            # Map language names to codes
            lang_codes = {
                'telugu': 'te',
                'english': 'en'
            }

            source_code = lang_codes.get(source_lang, source_lang)
            target_code = lang_codes.get(target_lang, target_lang)

            print(f"🔄 Translating from {source_lang} to {target_lang}...")

            translator = GoogleTranslator(source=source_code, target=target_code)
            translated = translator.translate(text)

            print(f"✅ Translation complete: {translated[:100]}...")
            return translated

        except Exception as e:
            print(f"❌ Translation failed: {e}")
            return text  # Return original text if translation fails

    def translate_structure(self, data, target_lang='telugu'):
        """Recursively translates strings in a JSON-like structure (dict/list)."""
        if not TRANSLATOR_AVAILABLE or target_lang == 'english':
            return data

        try:
            if isinstance(data, dict):
                return {k: self.translate_structure(v, target_lang) for k, v in data.items()}
            elif isinstance(data, list):
                return [self.translate_structure(item, target_lang) for item in data]
            elif isinstance(data, str):
                # Optimize: skip very short strings or internal keys which might be IDs
                if len(data.strip()) < 2 or data.isdigit():
                    return data
                # Don't translate URLs or file paths
                if data.startswith("http") or "/" in data:
                    return data
                return self.translate_text(data, 'english', target_lang)
            else:
                return data
        except Exception as e:
            print(f"⚠️ Structure translation failed: {e}")
            return data

    def generate_keywords_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured list of keywords using English prompt + Translation."""
        if not self.vectorstore:
            return '{"keywords": []}', [], "keywords"

        # 0. Translate Question if needed
        original_q = question
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Scope search
        filter_dict = {}
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
        
        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=5, filter=filter_dict)
            if not relevant_docs: return '{"keywords": []}', [], "keywords"
            
            context_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            sources = [doc.metadata.get('source', 'Unknown') for doc in relevant_docs]

            # 2. English Prompt
            print(f"🔑 Generating Keywords (English base): {question[:60]}...")
            kw_start = time.time()
            prompt = f"""### SYSTEM:
You are a Glossary Generator. Extract 5-8 important subject-specific terms from the provided TEXT.
Focus on the specific topic: "{question}".

### RULES:
1. Extract terms ONLY from the TEXT below.
2. Ignore terms like "figure", "table", "summary".
3. Do NOT define "keyword", "text", or "analysis".
4. Definitions must be simple and accurate.

### TEXT:
{context_text[:3000]}

### JSON OUTPUT:
{{
  "keywords": [
    {{
      "term": "Specific Term",
      "definition": "Definition from text.",
      "level": "Basic",
      "sections": ["Introduction"]
    }}
  ]
}}"""
            response_text = self.call_llama_optimized(prompt, num_predict=1500, format="json")
            
            # 3. Parse JSON
            import json
            try:
                # Cleaning
                clean_json = response_text
                if "```json" in response_text: clean_json = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text: clean_json = response_text.split("```")[1].split("```")[0]
                
                json_data = json.loads(clean_json)
                
                # 4. Translate if necessary
                if self.language == 'telugu':
                    print("🔄 Translating Keywords to Telugu...")
                    json_data = self.translate_structure(json_data, 'telugu')
                
                final_json = json.dumps(json_data)
                print(f"✅ Generated & Translated Keywords. Length: {len(final_json)}")
                return final_json, sources, "keywords"
                
            except Exception as e:
                print(f"❌ JSON Parse/Translate failed: {e}")
                return '{"keywords": []}', sources, "keywords"

        except Exception as e:
            print(f"❌ Keyword generation error: {e}")
            return '{"keywords": []}', [], "keywords"

    def generate_true_false_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates True/False questions using English prompt + Translation."""
        # 0. Translate Question if needed
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Scope search
        filter_dict = {}
        if selected_books: filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects: filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=8, filter=filter_dict)
            if not relevant_docs: return '{"questions": []}', [], "truefalse"

            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            sources = [doc.metadata.get('source', 'Unknown') for doc in relevant_docs]
            
            # Extract count
            import re
            count_match = re.search(r'(\d+)', question)
            q_count = int(count_match.group(1)) if count_match else 5
            
            # 2. English Prompt Strategy (Simplified for brevity)
            print(f"✅ Generating T/F Questions (English base)...")
            prompt = f"""### SYSTEM:
You are a Knowledgeable Teacher. Create {q_count} accurate True/False questions based on "{question}".

RULES:
1. FACTUAL ACCURACY IS PARAMOUNT. Double-check standard facts (e.g., geography).
2. "statement" must be a CLEAR, UNAMBIGUOUS sentence.
3. Avoid "technically true but incomplete" trick questions.
4. "explanation" must simply state WHY the answer is correct without contradiction.
5. If the Context is confusing, prioritize general academic truth.

### CONTEXT:
{context[:3500]}

### JSON OUTPUT:
{{
  "questions": [
    {{
      "statement": "The Southern Hemisphere has more water than the Northern Hemisphere.",
      "answer": true,
      "explanation": "Most of the Earth's landmass is in the North, making the South water-dominated.",
      "corrected_statement": "If false, copy the correct statement here."
    }}
  ]
}}"""
            response = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.1, format="json")

            # 3. Parse & Translate
            import json
            try:
                clean_json = response
                if "```json" in response: clean_json = response.split("```json")[1].split("```")[0]
                elif "```" in response: clean_json = response.split("```")[1].split("```")[0]
                
                json_data = json.loads(clean_json)
                if "questions" not in json_data: json_data = {"questions": []}
                
                # Filter to q_count just in case
                json_data["questions"] = json_data["questions"][:q_count]
                
                if self.language == 'telugu':
                    print("🔄 Translating T/F Questions to Telugu...")
                    json_data = self.translate_structure(json_data, 'telugu')
                
                final_json = json.dumps(json_data["questions"])
                return final_json, sources, "truefalse"
                
            except Exception as e:
                print(f"❌ T/F Parse/Translate failed: {e}")
                return '{"questions": []}', sources, "truefalse"

        except Exception as e:
            print(f"❌ T/F generation error: {e}")
            return '{"questions": []}', [], "truefalse"

    def generate_quiz_response(self, question: str, selected_subjects: list, selected_books: list):
        """Generate strictly formatted JSON quiz (English -> Translated)"""
        print(f"🧩 Generating Quiz: {question}")

        # 0. Translate Question if needed
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Check vectorstore
        if not self.vectorstore:
            return '{"error": "No textbooks loaded."}', [], "quiz"

        # 2. Scope Search
        filter_dict = None
        if selected_books: filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects: filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=4, filter=filter_dict)
            context = "\n\n".join([doc.page_content for doc in relevant_docs])[:2500]
        except Exception as e:
            print(f"⚠️ Quiz context search failed: {e}")
            context = "No specific textbook context found."

        # 3. English Prompt (ALWAYS)
        prompt = f"""### SYSTEM:
You are an Expert Teacher. Create a high-quality Multiple Choice Quiz about "{question}".

### CONTEXT:
{context}

### RULES:
1. Questions must be FACTUALLY ACCURATE and CONCEPTUAL.
2. If context lacks details, use STANDARD ACADEMIC KNOWLEDGE to ensure correctness.
3. Options must be UNIQUE and plausible. NO "All of the above".
4. ABSOLUTELY NO prefixes in options (e.g. "A)", "1."). Just the answer text.
5. Randomize the correct answer position.

### FORMAT:
[
  {{
    "question": "What is the primary function of...?",
    "options": ["Function A", "Function B", "Function C", "Function D"],
    "correct_index": 2,
    "explanation": "Function C is correct because..."
  }}
]

### JSON:"""

        # 4. Call LLM
        print(f"🧩 Sending quiz request to AI ({self.model_name})...")
        response = self.call_llama_optimized(prompt, num_predict=2500, temperature=0.0)
        
        # 5. Process & Translate
        try:
            import json
            clean_json = response
            if "```json" in response: clean_json = response.split("```json")[1].split("```")[0]
            elif "```" in response: clean_json = response.split("```")[1].split("```")[0]
            
            json_start = clean_json.find('[')
            json_end = clean_json.rfind(']')
            if json_start != -1 and json_end != -1:
                clean_json = clean_json[json_start:json_end+1]
            
            # Basic cleanup for common trailing commas
            clean_json = re.sub(r',\s*\]', ']', clean_json)
            
            json_data = json.loads(clean_json)
            
            # Normalize
            if isinstance(json_data, dict):
                json_data = json_data.get("quiz", json_data.get("questions", [json_data]))
            if not isinstance(json_data, list):
                json_data = [json_data]
                
            valid_questions = []
            for i, q in enumerate(json_data):
                if not isinstance(q, dict): continue
                
                # Lenient key matching
                question_text = q.get("question", q.get("text", ""))
                options = q.get("options", q.get("choices", []))
                correct_idx = q.get("correct_index", 0)
                explanation = q.get("explanation", "See above.")
                
                if not question_text or not isinstance(options, list) or len(options) < 2:
                    continue
                
                # CLEANUP: Remove prefixes if AI failed to follow rules
                clean_options = []
                for opt in options[:4]:
                    # Remove "A)", "A.", "1)", "(a)" etc
                    opt = re.sub(r'^[A-Da-d0-9]+[\.\)\-]\s*', '', str(opt))
                    clean_options.append(opt)

                valid_questions.append({
                    "id": i + 1,
                    "question": question_text,
                    "options": clean_options,
                    "correct_index": int(correct_idx) if str(correct_idx).isdigit() else 0,
                    "explanation": explanation
                })

            # TRANSLATION STEP
            if self.language == 'telugu' and valid_questions:
                print("🔄 Translating Quiz to Telugu...")
                valid_questions = self.translate_structure(valid_questions, 'telugu')

            final_json = json.dumps(valid_questions)
            print(f"✅ Generated & Translated Quiz. Length: {len(final_json)}")
            return final_json, [], "quiz"
            
        except Exception as e:
            print(f"❌ Quiz parsing/translation failed: {e}")
            return '{"error": "AI response was malformed."}', [], "quiz"

    def speak_text(self, text: str):
        """OFFLINE text-to-speech generation with thread-safe engine initialization"""
        if pyttsx3 is None:
            print("❌ pyttsx3 not installed")
            return None
        
        with self.tts_lock:
            try:
                print(f"🔊 Generating speech offline for: {text[:20]}...")
                
                # CRITICAL: Force reset of pyttsx3 singleton to respect thread affinity
                # This ensures we get a fresh engine for the current thread
                try:
                    if hasattr(pyttsx3, '_engine'):
                        del pyttsx3._engine
                except Exception:
                    pass

                # Initialize engine locally (this will now create a NEW instance)
                engine = pyttsx3.init()
                
                # Configure properties
                engine.setProperty('rate', 150)
                engine.setProperty('volume', 0.9)
                
                # Voice Selection Logic
                voices = engine.getProperty('voices')
                if voices:
                    selected_voice = None
                    for voice in voices:
                        if self.language == 'telugu' and ('telugu' in voice.name.lower() or 'te' in voice.id.lower()):
                            selected_voice = voice.id
                            break
                        elif self.language == 'english' and ('english' in voice.name.lower() or 'en' in voice.id.lower()):
                            # Prefer US english if available
                            if 'us' in voice.id.lower() or 'united states' in voice.name.lower():
                                selected_voice = voice.id
                                break
                            selected_voice = voice.id
                    
                    if selected_voice:
                        engine.setProperty('voice', selected_voice)
                    elif voices:
                        engine.setProperty('voice', voices[0].id)

                # Create temporary audio file
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                    temp_path = tmp_file.name
                
                # Close the file handle so pyttsx3 can open it
                tmp_file.close()
                
                # Generate speech offline
                engine.save_to_file(text, temp_path)
                engine.runAndWait()
                
                # Read generated audio
                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    with open(temp_path, 'rb') as audio_file:
                        audio_data = io.BytesIO(audio_file.read())
                    print(f"✅ Speech generated offline! Size: {os.path.getsize(temp_path)}")
                else:
                    print("❌ TTS File was empty or not created")
                    return None
                
                # Cleanup
                try:
                    os.unlink(temp_path)
                except:
                    pass
                
                # Final cleanup of engine
                if hasattr(engine, 'stop'):
                    engine.stop()
                try:
                    del engine
                except:
                    pass
                
                # Reset global singleton again just to be safe
                try:
                    if hasattr(pyttsx3, '_engine'):
                        del pyttsx3._engine
                except Exception:
                    pass
                    
                return audio_data
            
            except Exception as e:
                print(f"❌ Offline TTS error: {e}")
                import traceback
                traceback.print_exc()
                return None
    
    def check_llama_offline(self):
        """Check local Ollama availability with memory-safe fallback order"""
        print("🤖 Checking local AI availability...")
        # Lighter models prioritized for 8GB RAM stability
        fallback_order = ['qwen2.5:1.5b', 'llama3.2:1b', 'phi3:mini', 'phi3', 'llama3.2', 'mistral']
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=3)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]
                self.available_models = model_names # Store all tags for intelligent fallback
                
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
                    self.model_name = model_names[0].split(':')[0]
                    print(f"✅ Local AI ready (fallback): {self.model_name}")
                else:
                    self.llm_available = False
                    print("⚠️ Ollama running but no models found")
            else:
                self.llm_available = False
                print("⚠️ Ollama not responding properly")
        except:
            self.llm_available = False
            print("⚠️ Ollama not running - will use basic textbook search")
    
    def load_existing_data(self):
        """Load existing textbook data offline"""
        print("📂 Loading textbook data...")
        if os.path.exists("textbook_metadata.json"):
            with open("textbook_metadata.json", 'r', encoding='utf-8') as f:
                self.textbooks = json.load(f)
            print(f"📚 Loaded {len(self.textbooks)} textbooks offline")
        
        if os.path.exists("./ai_tutor_db"):
            try:
                self.vectorstore = Chroma(
                    persist_directory="./ai_tutor_db",
                    embedding_function=self.embeddings
                )
                print("✅ Vector database loaded offline!")
            except Exception as e:
                print(f"⚠️ Could not load vector database: {e}")
    
    def detect_brevity_intent(self, question: str) -> str:
        """Detect if user wants a brief, standard, or premium response with priority logic."""
        question_lower = question.lower().strip()
        
        # Priority 1: Elaborate variants (Deep/Details)
        elaborate_pattern = r'\b(detail|details|detailed|deeply|fully|elaborate|comprehensive|explain in detail|explain fully)\b'
        if re.search(elaborate_pattern, question_lower):
            return "premium"
            
        # Priority 2: Brief variants (Short/Quick)
        brief_pattern = r'\b(brief|briefly|short|quick|summary|nutshell|in short|in a nutshell|minimal)\b'
        if re.search(brief_pattern, question_lower):
            return "brief"
            
        # Fallback: Standard Mode (Balanced)
        return "standard"

    def log_metrics(self, mode: str, tokens: int, duration: float, model: str):
        """Log performance metrics to console and persistent JSON file with rotation."""
        # 1. Console Log
        print(f"⏱️ [{mode.capitalize()}] Generated {tokens} tokens in {duration:.2f}s using {model}")
        
        # 2. Persistent JSON Log
        metrics_file = "performance_metrics.json"
        metrics_data = []
        
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, 'r') as f:
                    metrics_data = json.load(f)
            except:
                metrics_data = []
        
        new_entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "mode": mode,
            "tokens": tokens,
            "time": round(duration, 2),
            "model": model
        }
        
        metrics_data.append(new_entry)
        
        # Log Rotation: Keep last 500 entries
        if len(metrics_data) > 500:
            metrics_data = metrics_data[-500:]
            
        try:
            with open(metrics_file, 'w') as f:
                json.dump(metrics_data, f, indent=2)
        except Exception as e:
            print(f"⚠️ Failed to write metrics: {e}")

    def clean_ai_response(self, text: str) -> str:
        """Clean AI response by removing block indentation and trimming whitespace."""
        if not text:
            return ""
            
        # 1. Strip overall whitespace
        text = text.strip()
        
        # 2. Aggressively remove common leading whitespace from all lines
        lines = text.split('\n')
        if len(lines) > 1:
            # Only consider non-empty lines for indentation calculation
            indents = []
            for line in lines:
                if line.strip():
                    match = re.match(r'^(\s*)', line)
                    indents.append(len(match.group(1)) if match else 0)
            
            if indents:
                min_indent = min(indents)
                if min_indent > 0:
                    cleaned_lines = []
                    for line in lines:
                        if len(line) >= min_indent:
                            cleaned_lines.append(line[min_indent:])
                        else:
                            cleaned_lines.append(line.lstrip())
                    text = '\n'.join(cleaned_lines)
        
        # 3. Final trim and return
        return text.strip()

    def is_general_conversation(self, question: str) -> bool:
        """Check if question is general conversation (no textbook search needed)"""
        general_patterns = [
            # English greetings
            r'\b(hi|hello|hey|good morning|good afternoon|good evening)\b',
            r'\bhow are you\b',
            r'\bwhat\'s up\b',
            r'\bthanks?( you)?\b',
            r'\bbye|goodbye\b',
            
            # Telugu greetings  
            r'\b(namaste|namaskar)\b',
            r'\bhello\b',
            r'\bhi\b',
            r'ఎలా ఉన్నారు',
            r'నమస్కారం',
            r'వందనాలు',
            
            # General conversational
            r'^\s*ok\s*$',
            r'^\s*yes\s*$',
            r'^\s*no\s*$',
            r'^\s*అవును\s*$',
            r'^\s*కాదు\s*$'
        ]
        
        question_lower = question.lower().strip()
        return any(re.search(pattern, question_lower, re.IGNORECASE) for pattern in general_patterns)
    
    def chat_with_ai_directly(self, question: str) -> str:
        """Direct AI chat without textbook search"""
        if not self.llm_available:
            if self.language == 'telugu':
                return "నమస్కారం! నేను మీ AI ఉపాధ్యాయుడిని. మీకు ఏదైనా ప్రశ్నలు ఉంటే అడగండి!"
            else:
                return "Hello! I'm your AI tutor. Ask me any questions about your studies!"
        
        if self.language == 'telugu':
            prompt = f"""You are a friendly AI tutor having a conversation with a Telugu student.
    The student said: "{question}"

    Respond naturally in Telugu. Be warm, encouraging, and helpful. If it's a greeting, greet back and ask how you can help with their studies.

    Respond in Telugu only."""
        else:
            prompt = f"""You are a friendly AI tutor having a conversation with a student.
    The student said: "{question}"

    Respond naturally in English. Be warm, encouraging, and helpful. If it's a greeting, greet back and ask how you can help with their studies.

    Respond in English only."""
        
        return self.call_llama(prompt, "")

    def chat_with_textbook_context(self, question: str, context: str, mode: str = "standard") -> str:
        """AI response with textbook context - DYNAMIC MODE SUPPORT"""
        
        # KEYWORDS MODE: Special Handling
        if mode == "keywords":
            if not self.llm_available:
                return '{"keywords": []}'
            
            # Sharper prompt for small models
            prompt = f"""You are a data extractor. Extract 5-10 academic keywords from the text.
Text:
{context}

Output ONLY valid JSON in this exact structure:
{{
  "keywords": [
    {{
      "term": "Term Name",
      "definition": "Short definition.",
      "level": "Basic|Important|Advanced",
      "sections": ["Section Name"],
      "definition_source": "textbook"
    }}
    }}
  ]
}}"""
            # Use JSON mode for absolute enforcement
            response = self.call_llama_optimized(prompt, num_predict=1500, format="json")
            
            # Translate if needed
            if self.language == 'telugu':
                # We need to parse strict json here to translate structure
                import json
                try:
                    clean = response
                    if "```json" in clean: clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean: clean = clean.split("```")[1].split("```")[0]
                    data = json.loads(clean)
                    data = self.translate_structure(data, 'telugu')
                    return json.dumps(data)
                except:
                    return response # Return raw if parse fails
            
            if not response.strip().startswith('{'):
                print(f"⚠️ Keyword AI failed to provide JSON. Returning empty JSON. Raw: {response[:100]}")
                return '{"keywords": []}'
            
            return response

        if not self.llm_available:
            if self.language == 'telugu':
                return f"పాఠ్యపుస్తక సమాచారం:\n\n{context}\n\nమరింత వివరాలు కావాలంటే దయచేసి నిర్దిష్ట ప్రశ్న అడగండి."
            else:
                return f"From your textbook:\n\n{context}\n\nAsk a specific question if you need more details."
        
        # 1. Define Prompt Structure based on Mode
        if mode == "brief":
            if self.language == 'telugu':
                task_instr = "విద్యార్థి ప్రశ్నకు సంక్షిప్తంగా, ఒకే పేరాగ్రాఫ్‌లో సమాధానం ఇవ్వండి. అనవసరమైన వివరణలు వద్దు."
            else:
                task_instr = "Provide a very brief, single-paragraph answer to the student's question. Be concise and avoid extra details."
        elif mode == "premium":
            if self.language == 'telugu':
                task_instr = """ముఖ్య గమనిక: విద్యార్థి అడిగిన ప్రశ్నకు మాత్రమే నేరుగా సమాధానం చెప్పండి. అనవసరమైన అంశాల జోలికి వెళ్లకండి.
1. ప్రత్యక్ష సమాధానం: ప్రశ్నకు నేరుగా, వివరణాత్మక సమాధానం.
2. వివరణ: సంక్లిష్టమైన అంశాలను సులభంగా వివరించండి.
3. ఉదాహరణలు: కనీసం ఒక నిజ జీవిత ఉదాహరణ జోడించండి.
4. ముగింపు: నేర్చుకోవడానికి ఒక ప్రోత్సాహకరమైన ముగింపు."""
            else:
                task_instr = """IMPORTANT: Focus ONLY on answering the student's question directly. Do not provide a general lecture.
1. Direct Detailed Answer: A comprehensive answer focused strictly on the question.
2. Conceptual Breakdown: Explain the 'why' and 'how' simply.
3. Real-World Case Study: Provide aRelatable analogy or example.
4. Summary & Logic: A quick recap of the answer's logic."""
        else: # Standard
            if self.language == 'telugu':
                task_instr = """1. సమాధానం: విద్యార్థి ప్రశ్నకు నేరుగా సమాధానం ఇవ్వండి.
2. వివరణ: అంశాన్ని క్లుప్తంగా వివరించండి.
3. ముగింపు: నేర్చుకోవడానికి ఒక ప్రోత్సాహకరమైన ముగింపు."""
            else:
                task_instr = """1. Answer: A direct response to the question.
2. Quick Explanation: A brief but clear context or explanation.
3. Encouragement: A positive closing thought to keep them studying."""

        # 2. Build Final Prompt
        # TRANSLATION APPROACH: Always generate in English, translate Telugu questions first
        if self.language == 'telugu' and TRANSLATOR_AVAILABLE:
            # Translate Telugu question to English for better AI understanding
            try:
                print(f"🔄 Translating Telugu question to English...")
                question_english = self.translate_text(question, 'telugu', 'english')
                print(f"   Telugu: {question[:60]}...")
                print(f"   English: {question_english[:60]}...")
                question = question_english  # Use translated question for prompt
            except Exception as e:
                print(f"⚠️ Question translation failed: {e}")

        # ALWAYS use English prompt (translation happens at the end)
        prompt = f"""You are an intelligent AI tutor helping a student.

Student Question: "{question}"

Textbook Content:
{context}

Your Task:
{task_instr}

CRITICAL INSTRUCTIONS:
1. Answer in clear, simple English
2. If the textbook content doesn't fully answer the question, USE YOUR GENERAL KNOWLEDGE
3. Do NOT say "this is not in your textbook" - just answer using what you know
4. Jump STRAIGHT into the answer
5. Provide accurate, helpful information

Answer:
"""
        # Mode-specific settings
        config = {
            "brief": {"predict": 250, "timeout": 180},
            "standard": {"predict": 600, "timeout": 300},
            "premium": {"predict": 1200, "timeout": 600}
        }.get(mode, {"predict": 600, "timeout": 300})

        # Generate response
        response = self.call_llama(prompt, mode=mode, num_predict=config["predict"], timeout=config["timeout"])

        # TRANSLATION APPROACH: If Telugu language, translate English response to Telugu
        if self.language == 'telugu' and TRANSLATOR_AVAILABLE:
            try:
                print(f"🔄 Translating English response to Telugu...")
                print(f"   English response: {response[:100]}...")
                telugu_response = self.translate_text(response, 'english', 'telugu')
                print(f"✅ Telugu response: {telugu_response[:100]}...")
                return telugu_response
            except Exception as e:
                print(f"⚠️ Translation failed, returning English response: {e}")
                return response

        return response

    def chat_with_general_knowledge(self, question: str, mode: str = "standard") -> str:
        """AI response using general knowledge when textbook doesn't have info (English -> Translated)"""
        if not self.llm_available:
            return "ఈ విషయం మీ పాఠ్యపుస్తకంలో లేదు. దయచేసి మీ ఉపాధ్యాయుడిని అడగండి." if self.language == 'telugu' else "This topic is not in your textbook. Please ask your teacher."
        
        # 1. Translate Question if needed
        if self.language == 'telugu':
             try:
                 print(f"🔄 Translating GK Question to English...")
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 2. Define Basic instructions based on mode
        if mode == "brief":
            prompt_instr = "Give a very short educational summary."
        elif mode == "premium":
            prompt_instr = "Provide a deep, comprehensive educational response with examples."
        else:
            prompt_instr = "Provide a helpful educational response."

        # 3. English Prompt
        prompt = f"""You are a helpful Tutor. 
Student Question: "{question}"

{prompt_instr}

Start with: "This topic isn't in your textbook, but I can explain..."
"""
        # Mode-specific settings
        config = {
            "brief": {"predict": 250, "timeout": 180},
            "standard": {"predict": 600, "timeout": 300},
            "premium": {"predict": 1200, "timeout": 600} 
        }.get(mode, {"predict": 600, "timeout": 300})
        
        # 4. Generate
        response = self.call_llama(prompt, mode=mode, num_predict=config["predict"], timeout=config["timeout"])
        
        # 5. Translate Response if needed
        if self.language == 'telugu':
            print("🔄 Translating GK Response to Telugu...")
            response = self.translate_text(response, 'english', 'telugu')

        return response
    
    def call_llama(self, prompt: str, context: str = "", mode: str = "standard", num_predict: int = None, timeout: int = None) -> str:
        """Make API call to local Ollama with dynamic budgets and robustness."""
        # Pick defaults if not provided
        if num_predict is None or timeout is None:
            config = {
                "brief": {"predict": 250, "timeout": 180},
                "standard": {"predict": 600, "timeout": 300},
                "premium": {"predict": 1200, "timeout": 600}
            }.get(mode, {"predict": 600, "timeout": 300})
            num_predict = num_predict or config["predict"]
            timeout = timeout or config["timeout"]
        candidates = [self.model_name]
        # Add fallback small models if available
        small_models = ['qwen2.5:1.5b', 'llama3.2:1b', 'phi3:mini', 'phi3']
        if hasattr(self, 'available_models'):
            for small in small_models:
                # Check if this exact small model exists in available_models
                found = next((m for m in self.available_models if small in m), None)
                if found and found not in candidates:
                    candidates.append(found)
            
        candidates = list(dict.fromkeys(candidates))
        last_error = ""
        
        for model in candidates:
            # Skip heavy models for brief responses if they struggle
            if mode == "brief" and model == "mistral":
                continue
                
            start_time = time.time()
            try:
                response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "num_predict": num_predict
                        }
                    },
                    timeout=timeout 
                )
                
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data['response']
                    eval_count = data.get('eval_count', 0) # approximation for tokens
                    
                    if model != self.model_name:
                        self.model_name = model
                    
                    self.log_metrics(mode, eval_count, duration, model)
                    return self.clean_ai_response(response_text)
                else:
                    last_error = f"Error {response.status_code}"
                    if response.status_code == 500 and "memory" in response.text.lower():
                        print(f"🚨 {model} hit Out of Memory. Trying smaller models...")
            
            except requests.exceptions.Timeout:
                # FALLBACK LOGIC: If Premium/Standard times out, try to return a result from a faster model or mode
                print(f"⌛ [{mode}] Request timed out for {model} after {timeout}s")
                if mode == "premium":
                    print("🔄 Falling back to Standard recovery...")
                    # Recursive call but in standard mode for faster recovery
                    return self.chat_with_textbook_context(prompt.split('"')[1], "...", mode="standard")
                last_error = "Request Timeout"
            except Exception as e:
                duration = time.time() - start_time
                print(f"❌ {model} failed: {e}")
                last_error = str(e)
                time.sleep(1)
                
        return f"❌ All AI models failed. Last error: {last_error}"
    
    def generate_quiz_response(self, question: str, selected_subjects: list, selected_books: list):
        """Generate strictly formatted JSON quiz"""
        print(f"🧩 Generating Quiz: {question}")

        # 1. Check if vectorstore exists
        if not self.vectorstore:
            print("⚠️ No vectorstore available - cannot generate quiz from textbooks")
            return '{"error": "No textbooks loaded. Please upload textbooks first."}', [], "quiz"

        # 2. Broad Context Search
        filter_dict = None
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            relevant_docs = self.vectorstore.similarity_search(
                question,
                k=4,
                filter=filter_dict
            )
            context = "\n\n".join([doc.page_content for doc in relevant_docs])[:2500]
        except Exception as e:
            print(f"⚠️ Quiz context search failed: {e}")
            context = "No specific textbook context found."

        # 3. Robust Prompt for Code-Block JSON with Verification Logic (Language-aware)
        if self.language == 'telugu':
            prompt = f"""మీరు ఒక నిపుణుడైన క్విజ్ నిర్మాత. JSON ఫార్మాట్‌లో 5 ప్రశ్నల క్విజ్ సృష్టించండి.

సందర్భం (CONTEXT):
{context}

నియమాలు (RULES):
- స్వచ్ఛమైన ఆప్షన్లు: కేవలం సమాధాన టెక్స్ట్ మాత్రమే. "A)", "B.", లేదా "1)" ప్రిఫిక్స్‌లు వద్దు.
- పరస్పర విశిష్టత: ఆప్షన్లు విభిన్నంగా ఉండాలి. ఒక ఆప్షన్ మాత్రమే సరైనది.
- వివరణ మొదట: "explanation" మొదట వ్రాసి, తర్వాత సరైన సూచిక ఎంచుకోండి.
- నిండుగా: ఉదాహరణ టెక్స్ట్ ఉపయోగించవద్దు. అసలైన, సందర్భానికి సంబంధించిన ఆప్షన్లు సృష్టించండి.
- స్కీమా: [{{"id": 1, "question": "ఉదాహరణ?", "options": ["ఆప్షన్ A", "ఆప్షన్ B", "ఆప్షన్ C", "ఆప్షన్ D"], "explanation": "వాస్తవం.", "correct_index": 0}}]

JSON అవుట్‌పుట్ (తెలుగులో ప్రశ్నలు మరియు ఆప్షన్లు):"""
        else:
            prompt = f"""You are an elite Quiz Expert. Generate a logical 5-question quiz in JSON format.

CONTEXT:
{context}

RULES:
- CLEAN OPTIONS: Provide only answer text. NO "A)", "B.", or "1)" prefixes.
- MUTUAL EXCLUSIVITY: Options must be distinct. Only ONE option must be true.
- REASONING FIRST: Write the "explanation" FIRST to confirm the facts, then pick the correct numerical index.
- NO FILLER: Do NOT use example text from the schema below. Create original, contextual options.
- Schema: [{{"id": 1, "question": "Example?", "options": ["Option A", "Option B", "Option C", "Option D"], "explanation": "Fact.", "correct_index": 0}}]

JSON OUTPUT:"""

        # 4. Call LLM (Locked temperature for maximum accuracy)
        print(f"🧩 Sending quiz request to AI ({self.model_name})...")
        quiz_start = time.time()
        response = self.call_llama_optimized(prompt, num_predict=2500, temperature=0.0)
        quiz_duration = time.time() - quiz_start
        print(f"⏱️ Quiz generation completed in {quiz_duration:.2f}s")
        
        # 5. Robust Post-processing
        try:
            # Extract JSON from code block
            clean_json = response
            if "```json" in response:
                clean_json = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                clean_json = response.split("```")[1].split("```")[0].strip()
            
            json_data = json.loads(clean_json) 
            
            if isinstance(json_data, dict):
                json_data = json_data.get("quiz", json_data.get("questions", [json_data]))
            
            # Validate and filter with extreme leniency
            valid_questions = []
            if not isinstance(json_data, list):
                # Check for "quiz" or "questions" wrappers
                if isinstance(json_data, dict):
                    found_list = json_data.get("quiz", json_data.get("questions", json_data.get("data", [])))
                    if isinstance(found_list, list):
                        json_data = found_list
                    else:
                        json_data = [json_data]
                else:
                    json_data = []

            for i, q in enumerate(json_data):
                if not isinstance(q, dict): continue
                
                # Lenient key matching for small models
                question_text = q.get("question", q.get("text", q.get("q", "")))
                options = q.get("options", q.get("choices", q.get("answers", [])))
                correct_idx = q.get("correct_index", q.get("answer_index", q.get("correct", 0)))
                explanation = q.get("explanation", q.get("reason", q.get("reasoning", "Fact-based explanation.")))

                if not question_text:
                    print(f"⚠️ Question {i} discarded: No question text found.")
                    continue
                
                # Final check for valid options
                if not isinstance(options, list) or len(options) < 2:
                    print(f"⚠️ Question {i} discarded: Options invalid or too few ({len(options) if isinstance(options, list) else 'type: '+str(type(options))})")
                    continue
                
                valid_questions.append({
                    "id": len(valid_questions) + 1,
                    "question": question_text,
                    "options": options[:4], # Keep max 4 for UI
                    "correct_index": int(correct_idx) if str(correct_idx).isdigit() else 0,
                    "explanation": explanation
                })
            
            if not valid_questions:
                print(f"❌ Failed to extract any valid questions from AI output.")
                print(f"📄 Full Cleaned JSON: {json.dumps(json_data)[:400]}")
                raise ValueError("No valid questions found.")

            print(f"✅ Successfully validated {len(valid_questions)} questions.")
            final_json = json.dumps(valid_questions)
            print(f"✅ Got response, mode=quiz, response length={len(final_json)}")
            return final_json, [], "quiz"
            
        except Exception as e:
            print(f"❌ Quiz parsing failed: {e}")
            print(f"📄 Raw response preview: {response[:300]}...")
            return '{"error": "AI response was malformed. Please try again."}', [], "quiz"

    def call_llama_optimized(self, prompt: str, num_predict: int = 1500, temperature: float = 0.1, format: str = None, model: str = None) -> str:
        """Specialized LLM call for structured data generation."""
        start_time = time.time()
        try:
            payload = {
                "model": model if model else self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": num_predict,
                    "num_ctx": 4096 # 4096 is safe for 1.5B/3B models on 8GB RAM.
                }
            }
            if format:
                payload["format"] = format

            response = requests.post(
                "http://localhost:11434/api/generate",
                json=payload,
                timeout=450 
            )
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                resp_json = response.json()
                text = resp_json['response'].strip()
                eval_count = resp_json.get('eval_count', 0)
                
                # Standardized timing/token log
                used_model = payload.get("model", self.model_name)
                print(f"🕒 [{used_model}] Generated {eval_count} tokens in {duration:.2f}s")
                
                if not text:
                    print(f"⚠️ Ollama returned empty response for model {self.model_name}")
                return text
            else:
                resp_text = response.text
                print(f"❌ Ollama Error: {response.status_code} - {resp_text}")
                
                # MEMORY SAFETY FALLBACK: If OOM detected, try a smaller model
                if response.status_code == 500 and "memory" in resp_text.lower():
                    print("🚨 Out of Memory detected. Attempting to switch to a smaller model...")
                    smalls = ['llama3.2:1b', 'qwen2.5:1.5b']
                    for small in smalls:
                        # Find if small model is available
                        match = next((name for name in getattr(self, 'available_models', []) if small in name), None)
                        if match and match != payload["model"]:
                             print(f"🔄 Retrying with smaller model: {match}")
                             # Update global model preference for this session to prevent future failures
                             self.model_name = match 
                             return self.call_llama_optimized(prompt, num_predict, temperature, format, model=match)
                    
                    print("❌ No smaller models found. Please run 'ollama run llama3.2:1b' to add a low-memory model.")
        except Exception as e:
            print(f"❌ call_llama_optimized Exception: {e}")
        return ""

    def generate_summary_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured, comprehensive summary of textbook content (English -> Translated)."""
        if not self.vectorstore:
            return "ఈ పాఠ్యపుస్తకంలో సారాంశం చేయడానికి తగిన పాఠం లేదు." if self.language == 'telugu' else "This textbook does not contain readable text to summarize.", [], "summary"

        # 0. Translate Question if needed
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Scope search
        filter_dict = {}
        if selected_books: filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects: filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=10, filter=filter_dict)
            if not relevant_docs: 
                 return "పాఠ్యపుస్తక సమాచారం దొరకలేదు." if self.language == 'telugu' else "Textbook content not found.", [], "summary"
            context = "\n\n".join([doc.page_content for doc in relevant_docs])[:4000]
        except Exception as e:
            print(f"⚠️ Summary search failed: {e}")
            return "శోధన విఫలమైంది." if self.language == 'telugu' else "Search failed.", [], "summary"

        # 2. English Prompt
        prompt = f"""You are a Content Strategist. Summarize this content related to "{question}".
STRUCTURE:
1. Title: Professional title.
2. Overview: 3-4 sentences.
3. Section Breakdown: Use Headings.
4. Key Takeaways: 5-8 bullet points.
5. Important Terms: List with definitions.

RULES:
- Simple language.
- Use markdown headings (###) and lists (-).
- NO hallucinations.

CONTENT:
{context}

SUMMARY OUTPUT:"""

        print(f"📚 Generating Summary: {question[:60]}...")
        response = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.0)
        
        # 3. Translate if Telugu
        if self.language == 'telugu':
            print("🔄 Translating Summary to Telugu...")
            # Translate section by section to preserve some markdown structure if possible
            # But deep_translator handles text well. Let's try full block.
            response = self.translate_text(response, 'english', 'telugu')

        if len(response) > 12000:
             response = response[:11950] + "\n\n[Truncated]"

        return response, [], "summary"

    def generate_flashcards_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates flashcards from textbook context (English -> Translated)."""
        print(f"🗂️ Generating Flashcards: {question[:60]}...")

        # 0. Translate Question if needed
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Search Context
        filter_dict = None
        if selected_books: filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects: filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=22, filter=filter_dict)
            base_docs = [doc.page_content for doc in relevant_docs]
            if not base_docs: return [], [], "error"
        except Exception as e:
            print(f"⚠️ Vector search failed: {e}")
            return [], [], "error"

        # 2. Count - Extract the FIRST number from the question for card count
        import re
        match = re.search(r'(\d+)', question)
        card_count = int(match.group(1)) if match else 10
        card_count = min(max(card_count, 5), 30)
        print(f"📊 Target flashcard count: {card_count}")

        # 3. Generation Loop (English Only)
        all_flashcards = []
        batch_size = 5
        passes = (card_count + batch_size - 1) // batch_size + 2

        for p in range(passes):
            if len(all_flashcards) >= card_count:
                print(f"✅ Reached target count: {len(all_flashcards)}/{card_count}")
                break

            needed = min(batch_size, card_count - len(all_flashcards))
            print(f"   🔹 Pass {p+1}: Need {needed} more flashcards (currently have {len(all_flashcards)})...")

            # Context Shuffle
            import random
            curr_docs = base_docs[:]
            if p > 0: random.shuffle(curr_docs)
            curr_context = "\n\n".join(curr_docs)[:4500]  # Increased context size

            prompt = f"""### INSTRUCTION:
Generate EXACTLY {needed + 2} high-quality flashcards from the text below.
CRITICAL RULES:
1. Each "front" MUST be a COMPLETE question (minimum 5 words)
2. Each "back" MUST be a COMPLETE answer (minimum 3 words)
3. DO NOT use incomplete questions like "What is...?" - use "What is an ocean?"
4. Questions must be clear, specific, and educational
5. Answers must be accurate and based on the text
6. "importance" must be one of: high, medium, low (lowercase only)
7. "hint" can be empty string "" if not needed

### TEXT:
{curr_context}

### GOOD EXAMPLES:
[
  {{"id": 1, "front": "What are the five major oceans on Earth?", "back": "Pacific, Atlantic, Indian, Arctic, and Southern Ocean", "hint": "Think of the largest water bodies", "importance": "high"}},
  {{"id": 2, "front": "How many continents are there on Earth?", "back": "There are seven continents", "hint": "Standard geographical classification", "importance": "medium"}}
]

### BAD EXAMPLES (DO NOT DO THIS):
[
  {{"front": "What is...?", "back": "Answer"}},
  {{"front": "Define", "back": "Def"}}
]

### NOW GENERATE {needed + 2} COMPLETE FLASHCARDS IN JSON FORMAT:"""

            response_text = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.3)
            
            try:
                # Clean JSON
                clean = response_text
                if "```json" in clean: clean = clean.split("```json")[-1].split("```")[0]
                elif "```" in clean: clean = clean.split("```")[-1].split("```")[0]
                
                start = clean.find('[')
                end = clean.rfind(']')
                if start != -1 and end != -1:
                    clean = clean[start:end+1]
                    clean = re.sub(r',\s*\]', ']', clean) # trailing comma fix
                    
                    data = json.loads(clean)
                    
                    # Validate, Dedup & Add
                    for card in data:
                        if len(all_flashcards) >= card_count: break
                        if 'front' in card and 'back' in card:
                            front = str(card['front']).strip()
                            back = str(card['back']).strip()

                            # VALIDATION: Reject incomplete or poor quality flashcards
                            # 1. Check minimum length (complete questions/answers)
                            if len(front.split()) < 4 or len(back.split()) < 2:
                                print(f"   ⚠️ Rejected incomplete card: '{front[:30]}' / '{back[:30]}'")
                                continue

                            # 2. Check for incomplete patterns
                            if front.endswith('...?') or front.endswith('...') or back.endswith('...'):
                                print(f"   ⚠️ Rejected truncated card: '{front[:30]}'")
                                continue

                            # 3. Simple dedup
                            if any(c['front'][:15] == front[:15] for c in all_flashcards):
                                continue

                            # 4. Normalize importance field
                            importance = str(card.get('importance', 'medium')).lower()
                            if importance not in ['high', 'medium', 'low']:
                                importance = 'medium'

                            # Add validated card
                            validated_card = {
                                'id': len(all_flashcards) + 1,
                                'front': front,
                                'back': back,
                                'hint': str(card.get('hint', '')).strip(),
                                'importance': importance
                            }
                            all_flashcards.append(validated_card)
                            print(f"   ✅ Added card #{len(all_flashcards)}: '{front[:40]}...'")

            except Exception as e:
                print(f"   ⚠️ Pass {p+1} JSON error: {e}")

        # 4. Translate Result with Better Context
        if self.language == 'telugu' and all_flashcards:
            print(f"🔄 Translating {len(all_flashcards)} Flashcards to Telugu (batched for quality)...")
            try:
                # Translate flashcards in a smarter way to preserve context
                translated_cards = []
                for i, card in enumerate(all_flashcards):
                    print(f"   Translating card {i+1}/{len(all_flashcards)}...")
                    translated_card = {
                        'id': card['id'],
                        'front': self.translate_text(card['front'], 'english', 'telugu'),
                        'back': self.translate_text(card['back'], 'english', 'telugu'),
                        'hint': self.translate_text(card['hint'], 'english', 'telugu') if card['hint'] else '',
                        'importance': card['importance']  # Keep English for this field
                    }
                    translated_cards.append(translated_card)
                all_flashcards = translated_cards
                print(f"✅ Translation complete!")
            except Exception as e:
                print(f"⚠️ Translation failed, using English: {e}")

        print(f"✅ Generated {len(all_flashcards)} cards.")
        return all_flashcards, [], "flashcards"

    def generate_oral_test_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured list of questions for an oral exam (English -> Translated)."""
        print(f"🎙️ Generating Oral Test Questions: {question[:60]}...")
        
        # 0. Translate Question if needed
        if self.language == 'telugu':
             try:
                 question = self.translate_text(question, 'telugu', 'english')
             except: pass

        # 1. Search
        filter_dict = None
        if selected_books: filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects: filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=15, filter=filter_dict)
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            if not context: return [], [], "error"
        except Exception as e:
            print(f"⚠️ Vector search failed: {e}")
            return [], [], "error"

        # 2. Count - Extract the FIRST number from the question
        import re
        match = re.search(r'(\d+)', question)
        q_count = int(match.group(1)) if match else 5
        q_count = min(max(q_count, 3), 15)
        print(f"📊 Target oral test question count: {q_count}")

        # 3. Generation Loop (English Only)
        all_questions = []
        batch_size = 5
        passes = (q_count + batch_size - 1) // batch_size + 2  # Add extra passes for safety

        for p in range(passes):
            if len(all_questions) >= q_count:
                print(f"✅ Reached target count: {len(all_questions)}/{q_count}")
                break

            needed = min(batch_size, q_count - len(all_questions))
            print(f"   🔹 Pass {p+1}: Need {needed} more questions (currently have {len(all_questions)})...")

            prompt = f"""### INSTRUCTION:
Generate EXACTLY {needed + 1} high-quality ORAL exam questions from the text below.
These are ORAL questions - students will SPEAK their answers, not write or draw anything.

CRITICAL RULES:
1. Each "question" MUST be ANSWERABLE BY SPEAKING (no drawing, writing, labeling, mapping)
2. Each "question" MUST be a COMPLETE question (minimum 5 words)
3. Each "sample_answer" MUST be a COMPLETE spoken answer (minimum 5 words)
4. Each "rubric" should list key points to check in student's VERBAL answer
5. Questions must test understanding through EXPLANATION, DESCRIPTION, or DISCUSSION
6. NO questions asking to: draw, sketch, map, label, write, fill in blanks, or point to things
7. Base all content on the provided TEXT

### TEXT:
{context[:4000]}

### GOOD ORAL QUESTIONS (Students can answer by speaking):
[
  {{
    "question": "Explain the water cycle and describe its main stages.",
    "sample_answer": "The water cycle involves evaporation from water bodies, condensation into clouds, precipitation as rain or snow, and collection back into water bodies.",
    "rubric": "Should mention evaporation, condensation, precipitation, and the cyclical nature"
  }},
  {{
    "question": "Name the seven continents and describe where they are located on Earth.",
    "sample_answer": "The seven continents are Asia, Africa, North America, South America, Antarctica, Europe, and Australia. Asia and Europe are in the eastern hemisphere, while North and South America are in the western hemisphere.",
    "rubric": "Should name all seven continents and mention their general locations"
  }},
  {{
    "question": "What are the differences between oceans and seas?",
    "sample_answer": "Oceans are larger bodies of salt water that cover most of Earth's surface, while seas are smaller and are usually partially enclosed by land. Oceans include the Pacific, Atlantic, Indian, Arctic, and Southern Ocean.",
    "rubric": "Should mention size difference and that seas are more enclosed"
  }}
]

### BAD ORAL QUESTIONS (NEVER DO THIS - These require physical actions):
[
  {{"question": "Draw the continents on paper", "sample_answer": "...", "rubric": "..."}},
  {{"question": "Label all oceans on the map", "sample_answer": "...", "rubric": "..."}},
  {{"question": "Write the names of five countries", "sample_answer": "...", "rubric": "..."}},
  {{"question": "Sketch a diagram of the water cycle", "sample_answer": "...", "rubric": "..."}}
]

### NOW GENERATE {needed + 1} COMPLETE ORAL QUESTIONS (ANSWERABLE BY SPEAKING) IN JSON FORMAT:"""

            response = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.2, format="json")

            try:
                # Clean & Parse
                clean = response
                if "```json" in clean: clean = clean.split("```json")[-1].split("```")[0]
                elif "```" in clean: clean = clean.split("```")[-1].split("```")[0]

                start = clean.find('[')
                end = clean.rfind(']')
                if start != -1 and end != -1:
                    clean = clean[start:end+1]
                    clean = re.sub(r',\s*\]', ']', clean)  # trailing comma fix
                    data = json.loads(clean)

                    if isinstance(data, list):
                        for q in data:
                            if len(all_questions) >= q_count:
                                break

                            if 'question' in q and 'sample_answer' in q:
                                question_text = str(q['question']).strip()
                                answer_text = str(q['sample_answer']).strip()

                                # VALIDATION 1: Reject incomplete questions
                                if len(question_text.split()) < 4 or len(answer_text.split()) < 4:
                                    print(f"   ⚠️ Rejected incomplete question: '{question_text[:40]}'")
                                    continue

                                # VALIDATION 2: Check for truncation
                                if question_text.endswith('...') or answer_text.endswith('...'):
                                    print(f"   ⚠️ Rejected truncated question: '{question_text[:40]}'")
                                    continue

                                # VALIDATION 3: Reject questions requiring physical actions (not oral)
                                physical_action_keywords = [
                                    'draw', 'sketch', 'label', 'map', 'write', 'fill in', 'fill out',
                                    'mark', 'circle', 'underline', 'point to', 'show on', 'trace',
                                    'color', 'shade', 'diagram on paper', 'on the map', 'on paper',
                                    'గీయండి', 'వ్రాయండి', 'చూపించండి', 'మ్యాప్', 'కాగితం',  # Telugu keywords
                                    'రేఖాచిత్రం', 'లేబుల్'
                                ]
                                question_lower = question_text.lower()
                                if any(keyword in question_lower for keyword in physical_action_keywords):
                                    print(f"   ⚠️ Rejected non-oral question (requires physical action): '{question_text[:50]}'")
                                    continue

                                # Simple dedup
                                if any(x['question'][:15] == question_text[:15] for x in all_questions):
                                    continue

                                # Add validated question
                                validated_q = {
                                    'id': len(all_questions) + 1,
                                    'question': question_text,
                                    'sample_answer': answer_text,
                                    'rubric': str(q.get('rubric', 'Check understanding of key concepts')).strip()
                                }
                                all_questions.append(validated_q)
                                print(f"   ✅ Added question #{len(all_questions)}: '{question_text[:45]}...'")

            except Exception as e:
                print(f"   ⚠️ Pass {p+1} JSON error: {e}")
                import traceback
                traceback.print_exc()

        # 4. Translate Result with Better Context
        if self.language == 'telugu' and all_questions:
            print(f"🔄 Translating {len(all_questions)} Oral Test Questions to Telugu (batched for quality)...")
            try:
                translated_questions = []
                for i, q in enumerate(all_questions):
                    print(f"   Translating question {i+1}/{len(all_questions)}...")
                    translated_q = {
                        'id': q['id'],
                        'question': self.translate_text(q['question'], 'english', 'telugu'),
                        'sample_answer': self.translate_text(q['sample_answer'], 'english', 'telugu'),
                        'rubric': self.translate_text(q['rubric'], 'english', 'telugu')
                    }
                    translated_questions.append(translated_q)
                all_questions = translated_questions
                print(f"✅ Translation complete!")
            except Exception as e:
                print(f"⚠️ Translation failed, using English: {e}")

        if not all_questions:
            print("❌ Failed to generate any valid questions")
            return [], [], "error"

        print(f"✅ Generated {len(all_questions)} oral test questions.")
        return all_questions, [], "oral_test"

    def generate_mindmap_response(self, book_id: str, language: str = 'en'):
        """Generates a hierarchical mind map structure (English -> Translated)."""
        print(f"🧠 Generating Mind Map for book_id: {book_id}...")
        
        # 1. Retrieve Context
        try:
            docs = self.vectorstore.similarity_search("Main concepts and structure", k=12, filter={"book_id": book_id})
            context = "\n\n".join([doc.page_content for doc in docs])
            if not context: return {"error": "Content not found."}, [], "error"
        except Exception as e:
            return {"error": "Database error."}, [], "error"

        # 2. English Prompt (Line-Based)
        prompt = f"""### SYSTEM:
Create a hierarchical mind map in English.
Format:
ROOT: [Chapter Title]
SUBTOPIC: [Main Branch]
CONCEPT: [Key Concept]
DETAIL: [Brief Detail]

Rules:
- NO questions.
- 5-8 Subtopics.
- 3 Concepts per Subtopic.

### TEXT:
{context[:6000]}

### MIND MAP OUTPUT:"""

        # 3. Generation
        response_text = self.call_llama_optimized(prompt, num_predict=3000, temperature=0.4)
        
        # 4. Parse
        try:
            mind_map = {"title": "Mind Map", "subtopics": []}
            curr_sub = None
            curr_con = None
            
            seen_ids = set()
            def gid(p): 
                ni = f"{p}_{len(seen_ids)}"
                seen_ids.add(ni)
                return ni

            for line in response_text.split('\n'):
                line = line.strip()
                if not line: continue
                
                if line.startswith("ROOT:"):
                    mind_map["title"] = line.replace("ROOT:", "").strip()
                elif line.startswith("SUBTOPIC:"):
                    curr_sub = {"id": gid("st"), "name": line.replace("SUBTOPIC:", "").strip(), "concepts": []}
                    mind_map["subtopics"].append(curr_sub)
                    curr_con = None
                elif line.startswith("CONCEPT:") and curr_sub:
                    curr_con = {"id": gid("c"), "name": line.replace("CONCEPT:", "").strip(), "details": [], "connections": []}
                    curr_sub["concepts"].append(curr_con)
                elif line.startswith("DETAIL:") and curr_con:
                    curr_con["details"].append(line.replace("DETAIL:", "").strip())

            # 5. Translate
            if language == 'telugu': # Use passed language arg or self.language
                print("🔄 Translating Mind Map to Telugu...")
                # self.language is reliable here
                if self.language == 'telugu':
                    mind_map = self.translate_structure(mind_map, 'telugu')

            return mind_map, [], "mindmap"

        except Exception as e:
            print(f"❌ Mind Map error: {e}")
            return {"error": "Parsing error."}, [], "error"

    def transcribe_file(self, audio_path):
        """Transcribe an audio file using the local Whisper model."""
        # Ensure ASR is set up
        if not hasattr(self, 'asr_available') or not self.asr_available:
            self.setup_asr_offline()

        if not self.asr_available:
            return None, "ASR not available"

        try:
            print(f"🎤 Transcribing audio: {audio_path}")

            # LAZY LOAD: Load Whisper model if not already loaded
            if self.whisper_model is None:
                import whisper
                device = "cuda" if self.has_cuda else "cpu"
                model_name = getattr(self, 'whisper_model_name', 'base')

                print(f"🔄 Loading OpenAI Whisper '{model_name}' model (first use)...")

                try:
                    # Load the large model for Telugu transcription accuracy
                    self.whisper_model = whisper.load_model(model_name, device=device)
                    print(f"✅ OpenAI Whisper '{model_name}' model loaded on {device.upper()}!")
                except Exception as e:
                    # Don't fallback to tiny - it doesn't work well for Telugu
                    print(f"❌ Failed to load '{model_name}' model: {e}")
                    print(f"⚠️ Note: Only 'large' model works well for Telugu transcription")
                    print(f"⚠️ Please ensure you have a stable internet connection to download the model")
                    return None, f"Failed to load Whisper model: {str(e)}"

            # OpenAI Whisper returns a dictionary, not (segments, info)
            # Use appropriate language based on current language setting
            language_code = 'te' if self.language == 'telugu' else 'en'

            # OPTIMIZED FOR TELUGU: OpenAI Whisper has excellent Telugu support
            print(f"🎯 Transcribing in {self.language.upper()} (language code: {language_code})...")

            result = self.whisper_model.transcribe(
                audio_path,
                language=language_code,  # 'te' for Telugu, 'en' for English
                task="transcribe",
                verbose=False,
                fp16=self.has_cuda,  # Use FP16 if GPU available
                # Optimized parameters for better Telugu accuracy
                temperature=0.0,  # Deterministic for consistency
                best_of=5,  # Sample multiple times for best result
                beam_size=5  # Beam search for higher accuracy
            )

            transcript = result["text"].strip()

            # Validate Telugu script if language is Telugu
            if self.language == 'telugu' and transcript:
                has_telugu = any('\u0c00' <= char <= '\u0c7f' for char in transcript)
                if has_telugu:
                    print(f"✅ Telugu script validated in transcript")
                elif len(transcript) > 10:
                    print(f"⚠️ Warning: No Telugu script detected, might be English/numbers")

            print(f"📄 Transcription complete ({len(transcript)} chars): {transcript[:60]}...")
            return transcript, None
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            import traceback
            traceback.print_exc()
            return None, str(e)

    def analyze_oral_transcript(self, question, sample_answer, transcript):
        """AI Auto-Review of Oral Test transcript (Works for Telugu and English)."""
        # Build language-aware prompt
        lang_note = ""
        if self.language == 'telugu':
            lang_note = "NOTE: The student's answer is in TELUGU. Compare meaning, not exact wording."
        else:
            lang_note = "NOTE: The student's answer is in ENGLISH. Compare meaning, not exact wording."

        prompt = f"""You are an educational assessment AI. Evaluate the student's oral answer.

{lang_note}

QUESTION: {question}
EXPECTED ANSWER: {sample_answer}
STUDENT'S ANSWER: {transcript}

SCORING CRITERIA:
- Score 5: Excellent - Covers all key points accurately
- Score 4: Good - Covers most key points with minor gaps
- Score 3: Satisfactory - Covers some key points, missing important details
- Score 2: Poor - Minimal understanding, many gaps
- Score 1: Incorrect - Major misunderstanding or irrelevant

IMPORTANT:
- Focus on MEANING and CONCEPTS, not exact words
- Be lenient with pronunciation variations in transcription
- Award points for partial understanding
- If answer is very short/unclear, give score 2-3

OUTPUT ONLY THIS JSON FORMAT:
{{
  "score": <1-5>,
  "feedback": "<Brief constructive feedback in English>",
  "confidence": "<high/medium/low>",
  "keywords_detected": ["<key concepts mentioned>"]
}}"""

        try:
            print(f"🤖 Analyzing answer in {self.language}...")
            response = self.call_llama_optimized(prompt, num_predict=1200, temperature=0.1, format="json")
            import json

            # Clean JSON
            clean = response
            if "```json" in clean: clean = clean.split("```json")[-1].split("```")[0]
            elif "```" in clean: clean = clean.split("```")[-1].split("```")[0]

            # Extract JSON object
            start = clean.find('{')
            end = clean.rfind('}')
            if start != -1 and end != -1:
                clean = clean[start:end+1]

            analysis = json.loads(clean)

            # Validate score
            if not isinstance(analysis.get("score"), (int, float)) or not (1 <= analysis["score"] <= 5):
                analysis["score"] = 3

            # Translate feedback to Telugu if needed
            if self.language == 'telugu' and analysis.get("feedback"):
                try:
                    analysis["feedback"] = self.translate_text(analysis["feedback"], 'english', 'telugu')
                except:
                    pass  # Keep English feedback if translation fails

            print(f"✅ AI Analysis: Score {analysis['score']}/5, Confidence: {analysis.get('confidence', 'medium')}")
            return analysis

        except Exception as e:
            print(f"⚠️ Analysis parsing error: {e}")
            # Return neutral score if analysis fails
            feedback = "AI analysis unavailable - needs manual review" if self.language == 'english' else "AI విశ్లేషణ అందుబాటులో లేదు - మాన్యువల్ సమీక్ష అవసరం"
            return {
                "score": 3,
                "feedback": feedback,
                "confidence": "low",
                "keywords_detected": []
            }

    def generate_one_page_revision_response(self, book_id: str, language: str = 'en'):
        """Generates a Single-Page Revision Sheet (English -> Translated)."""
        print(f"🧠 Generating Revision Sheet for book_id: {book_id}...")
        
        try:
            docs = self.vectorstore.similarity_search(f"summary case study for book {book_id}", k=12, filter={"book_id": book_id})
            if not docs: return {"status": "error", "response": "No content."}, [], "revision"
            context = "\n".join([d.page_content for d in docs])[:5000]
            
            # English Prompt
            prompt = f"""### SYSTEM:
Fill out this EXACT Revision Sheet Template in English.
LESSON_TITLE: [Title]
SOURCE: [Source]
IMPORTANT_DATE: [Dates]
BACKGROUND:
- [Point 1]
KEY_INFORMATION:
- [Fact 1]
EFFECTS:
- [Effect 1]
IMPORTANT_TERMS:
- [Term 1] || [Definition 1]
PRACTICE_QUESTIONS:
- [Question 1]

Rules:
- NO "Activity" questions.
- Conceptual questions only.
- Full sentences.

### CONTEXT:
{context}

### FILLED TEMPLATE:"""

            response_text = self.call_llama_optimized(prompt, num_predict=3000, temperature=0.1)
            
            # Parse
            revision_data = {"topic": "", "where": "", "when": "", "why": [], "facts": [], "impacts": [], "keywords": [], "definitions": [], "exam_question": []}
            curr_sect = None
            
            for line in response_text.split('\n'):
                line = line.strip()
                if not line: continue
                u_line = line.upper()
                
                if "LESSON_TITLE" in u_line: revision_data["topic"] = line.split(":", 1)[1].strip()
                elif "SOURCE" in u_line: revision_data["where"] = line.split(":", 1)[1].strip()
                elif "IMPORTANT_DATE" in u_line: revision_data["when"] = line.split(":", 1)[1].strip()
                elif "BACKGROUND" in u_line: curr_sect = "why"
                elif "KEY_INFORMATION" in u_line: curr_sect = "facts"
                elif "EFFECTS" in u_line or "IMPACTS" in u_line: curr_sect = "impacts"
                elif "IMPORTANT_TERMS" in u_line: curr_sect = "terms"
                elif "PRACTICE_QUESTIONS" in u_line: curr_sect = "exam_question"
                
                elif curr_sect == "terms" and "||" in line:
                    parts = line.lstrip("- ").split("||")
                    if len(parts) == 2:
                        revision_data["keywords"].append(parts[0].strip())
                        revision_data["definitions"].append(parts[1].strip())
                elif curr_sect and (line.startswith("-") or line.startswith("•")):
                     content = line.lstrip("-• ").strip()
                     if curr_sect == "exam_question" and len(revision_data["exam_question"]) < 5:
                         revision_data["exam_question"].append(content)
                     elif curr_sect in revision_data and isinstance(revision_data[curr_sect], list):
                         revision_data[curr_sect].append(content)
            
            # Translate
            if language == 'telugu' or self.language == 'telugu':
                print("🔄 Translating Revision Sheet to Telugu...")
                revision_data = self.translate_structure(revision_data, 'telugu')

            return revision_data, [], "revision"
            
        except Exception as e:
            print(f"❌ Revision Error: {e}")
            return {"status": "error", "response": str(e)}, [], "revision"

    def get_response(self, question: str, selected_subjects: list = None, selected_books: list = None, mode: str = None):
        """SMART response routing with book-level scoping and intent-based optimization."""
        print(f"🧠 Processing question: {question[:50]}...")
        
        # STEP 0: Check for Special Modes
        if mode == "quiz":
            return self.generate_quiz_response(question, selected_subjects, selected_books)
        if mode == "summary":
            return self.generate_summary_response(question, selected_subjects, selected_books)
        if mode == "keywords":
            return self.generate_keywords_response(question, selected_subjects, selected_books)
        if mode == "truefalse" or mode == "true_false":
            return self.generate_true_false_response(question, selected_subjects, selected_books)
        if mode == "flashcards":
            return self.generate_flashcards_response(question, selected_subjects, selected_books)
        if mode == "oral_test":
            return self.generate_oral_test_response(question, selected_subjects, selected_books)
        if mode == "mindmap":
            book_id = selected_books[0] if selected_books else "unknown"
            return self.generate_mindmap_response(book_id, language=self.language)
        if mode == "revision":
            book_id = selected_books[0] if selected_books else "unknown"
            return self.generate_one_page_revision_response(book_id, language=self.language)

        # STEP 1: Detect Intent (Brevity vs Elaboration)
        if not mode:
            mode = self.detect_brevity_intent(question)
        
        # STEP 2: Check if it's general conversation (no textbook search needed)
        if self.is_general_conversation(question):
            print(f"💬 Detected general conversation ({mode}) - no textbook search")
            response = self.call_llama(question, mode=mode) 
            return response, [], mode
        
        # STEP 3: Search textbook with correct scoping
        print(f"🔍 Searching textbook... Mode: {mode.upper()} | (Books: {selected_books}, Subjects: {selected_subjects})")
        
        filter_dict = None
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
        
        search_start = time.time()
        try:
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=3 if mode == "premium" else 2, # More context for premium
                filter=filter_dict
            )
            search_duration = time.time() - search_start
            print(f"⏱️ Content retrieval took {search_duration:.2f}s")
        except Exception as e:
            search_duration = time.time() - search_start
            print(f"⚠️ Search filter failed ({e}) after {search_duration:.2f}s, falling back to unfiltered search")
            relevant_docs = self.vectorstore.similarity_search(question, k=2)
        
        # STEP 4: Smart routing based on search results
        if relevant_docs and len(relevant_docs[0].page_content.strip()) > 100:
            print(f"📚 Found textbook content - generating {mode} AI analysis...")
            full_context = "\n\n".join([doc.page_content for doc in relevant_docs])
            context = full_context[:3500 if mode == "premium" else 2500] 
            ai_response = self.chat_with_textbook_context(question, context, mode=mode)
            
            sources = []
            page_text = "పేజీ" if self.language == 'telugu' else "Page"
            for doc in relevant_docs:
                page_num = doc.metadata.get('page', 'Unknown')
                subject = doc.metadata.get('subject', 'Unknown')
                sources.append(f"{subject} - {page_text} {page_num}")
            
            return ai_response, sources, mode
        
        else:
            print(f"🧠 No textbook content found - using AI general knowledge in {mode} mode...")
            ai_response = self.chat_with_general_knowledge(question, mode=mode)
            return ai_response, [], mode

# For backward compatibility with your existing UI files
AITextbookTutorMultilingualBackend = AITextbookTutorMultilingualBackendOffline
