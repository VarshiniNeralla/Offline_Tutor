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
# from faster_whisper import WhisperModel
import torch
try:
    import pyttsx3  # OFFLINE TTS instead of gTTS
except ImportError:
    pyttsx3 = None
import tempfile
import io
import re
import time
import random


warnings.filterwarnings('ignore')

class AITextbookTutorMultilingualBackendOffline:
    def __init__(self, language='telugu'):
        print(f"Initializing Offline AI Tutor ({language})...")
        self.language = language
        self.textbooks = {}
        self.vectorstore = None
        self.setup_embeddings_offline()
        self.check_llama_offline()
        if self.language == 'telugu':
            self.setup_telugu_asr_offline()
        else:
            self.asr_available = False
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
        
    def setup_telugu_asr_offline(self):
        """Setup Telugu speech recognition with detailed error reporting"""
        try:
            print("🎤 Starting Telugu speech recognition setup...")
            
            # Check faster-whisper import
            try:
                from faster_whisper import WhisperModel
                print("✅ faster-whisper imported successfully")
            except ImportError as e:
                print(f"❌ faster-whisper import failed: {e}")
                print("💡 Run: pip install faster-whisper")
                self.asr_available = False
                self.asr_error = "faster-whisper not installed"
                return
            
            os.makedirs("./models/whisper", exist_ok=True)
            print("✅ Models directory created")
            
            # Try standard models first for testing
            print("🔄 Loading Whisper base model for testing...")
            try:
                self.whisper_model = WhisperModel(
                    "base",  # Use standard Whisper base model first
                    device="cpu",
                    compute_type="int8",
                    download_root="./models/whisper"
                )
                self.asr_available = True
                self.asr_error = None
                print("✅ Whisper base model loaded successfully!")
                print("💡 Telugu language will be detected automatically")
                
            except Exception as base_error:
                print(f"❌ Even base model failed: {base_error}")
                self.asr_available = False
                self.asr_error = f"Model loading failed: {str(base_error)}"
                
        except Exception as e:
            print(f"❌ ASR setup completely failed: {e}")
            self.asr_available = False
            self.asr_error = f"Setup failed: {str(e)}"
            """Setup Telugu speech recognition - NO FFMPEG NEEDED"""
            try:
                print("🎤 Loading Telugu speech recognition (faster-whisper)...")
                
                os.makedirs("./models/whisper", exist_ok=True)
                
                # faster-whisper doesn't need FFmpeg
                self.whisper_model = WhisperModel(
                    "vasista22/whisper-telugu-base", 
                    device="cpu",
                    compute_type="int8",  # Optimized for your 8GB RAM
                    download_root="./models/whisper"
                )
                self.asr_available = True
                print("✅ Telugu Speech Recognition Ready (No FFmpeg needed)!")
                
            except ImportError:
                print("❌ faster-whisper not installed. Run: pip install faster-whisper")
                self.asr_available = False
            except Exception as e:
                print(f"❌ Telugu ASR setup failed: {e}")
    
    def setup_offline_tts(self):
        """Setup OFFLINE Text-to-Speech using pyttsx3"""
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
        """Telugu transcription with script validation"""
        if not self.asr_available:
            return "❌ Telugu speech recognition not available"
        
        try:
            print("🎤 Transcribing with script validation...")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_file.getvalue())
                tmp_path = tmp_file.name
            
            # Transcribe with Telugu language forced
            print("2hiiiiiii")
            segments, info = self.whisper_model.transcribe(
                tmp_path,
                beam_size=5,
                language="te",
                task="transcribe",
                temperature=0.0  # More deterministic
            )
            
            transcribed_text = " ".join([segment.text for segment in segments])
            print(transcribed_text)
            print("hiiiiiii")
            # Validate if output contains Telugu script
            has_telugu_script = any('\u0c00' <= char <= '\u0c7f' for char in transcribed_text)
            
            if  not has_telugu_script:
                print("⚠️ Detected Arabic script instead of Telugu!")
                return "❌ Model error: Outputting Arabic script instead of Telugu. Please try again or check audio quality."
            
            os.unlink(tmp_path)
            print(f"✅ Transcribed: {transcribed_text[:50]}...")
            return transcribed_text
            
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return f"❌ Transcription error: {str(e)}"

    def generate_keywords_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured list of keywords from the provided scope."""
        if not self.vectorstore:
            return '{"keywords": []}', [], "keywords"

        # 1. Scope search by book/subject
        filter_dict = {}
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            # High-density retrieval for keywords
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=5, # Further reduced to stay safely within token limits
                filter=filter_dict
            )
            
            if not relevant_docs:
                return '{"keywords": []}', [], "keywords"

            # 2. Prepare Context
            context_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            sources = [doc.metadata.get('source', 'Unknown') for doc in relevant_docs]

            # 3. Call Keyword Prompt
            # Pass to chat_with_textbook_context which now handles 'keywords' mode
            response_text = self.chat_with_textbook_context(question, context_text, mode="keywords")
            
            # Double check JSON-like string
            if not response_text.strip().startswith('{'):
                 return '{"keywords": []}', sources, "keywords"

            return response_text, sources, "keywords"
            
        except Exception as e:
            print(f"❌ Keyword generation failed: {e}")
            return '{"keywords": []}', [], "keywords"

    def generate_true_false_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates True/False questions based on textbook context."""
        # Selection logic similar to keywords
        filter_dict = {}
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            # Retrieve more chunks but sample them to ensure diversity
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=8, # Get a broader pool
                filter=filter_dict
            )
            
            if relevant_docs:
                # Randomly pick subset of chunks to prevent same questions
                sample_size = min(len(relevant_docs), 4)
                relevant_docs = random.sample(relevant_docs, sample_size)
            
            if not relevant_docs:
                try:
                    # Fallback: Just grab ANY content from the same books/subjects if search is too specific
                    relevant_docs = self.vectorstore.similarity_search("", k=5, filter=filter_dict)
                    if not relevant_docs:
                        return '{"questions": []}', [], "truefalse"
                except:
                    return '{"questions": []}', [], "truefalse"

            context_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            sources = [doc.metadata.get('source', 'Unknown') for doc in relevant_docs]

            # Call AI with truefalse mode
            response_text = self.chat_with_textbook_context(question, context_text, mode="truefalse")
            
            return response_text, sources, "truefalse"
            
        except Exception as e:
            print(f"❌ True/False generation failed: {e}")
            return '{"questions": []}', [], "truefalse"

        
    def speak_text(self, text: str):
        """OFFLINE text-to-speech generation"""
        if not self.tts_available:
            return None
        
        try:
            print("🔊 Generating speech offline...")
            
            # Create temporary audio file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                temp_path = tmp_file.name
            
            # Generate speech offline
            self.tts_engine.save_to_file(text, temp_path)
            self.tts_engine.runAndWait()
            
            # Read generated audio
            with open(temp_path, 'rb') as audio_file:
                audio_data = io.BytesIO(audio_file.read())
            
            # Cleanup
            os.unlink(temp_path)
            
            print("✅ Speech generated offline!")
            return audio_data
        
        except Exception as e:
            print(f"❌ Offline TTS error: {e}")
            return None
    
    def check_llama_offline(self):
        """Check local Ollama availability with memory-safe fallback order"""
        print("🤖 Checking local AI availability...")
        # Lighter models prioritized for 8GB RAM stability
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
            
            # Ultra-fast extraction prompt for local models
            prompt = f"""[INST] Extract 5 keywords from this text.
Text: {context[:2000]}
Output ONLY valid JSON:
{{
  "keywords": [
    {{
      "term": "Term",
      "definition": "Meaning",
      "level": "Basic",
      "sections": ["Section"]
    }}
  ]
}} [/INST]"""
            # Use standard fast call (NOT JSON mode which is slow on cpu/local)
            response = self.call_llama(prompt, mode="brief", num_predict=1000, timeout=180)
            
            # Extract JSON from potential conversational filler
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                response = json_match.group(0)
            
            if not response.strip().startswith('{'):
                print(f"⚠️ Keyword AI failed. Raw: {response[:100]}")
                return '{"keywords": []}'
            
            return response

        if mode == "truefalse":
            # Extract count from question if possible (e.g., "Identify 10...")
            count_match = re.search(r'(\d+)', question)
            q_count = int(count_match.group(1)) if count_match else 5
            
            # MULTI-PASS STRATEGY: Split large counts into chunks of 5
            # This is much more reliable on slow local CPUs than one large call
            pass_count = (q_count + 4) // 5  # e.g., 10 -> 2 passes, 15 -> 3 passes
            all_questions = []
            
            for p in range(pass_count):
                # Slightly shift context for each pass to get variety
                current_context_start = p * 1000
                current_context = context[current_context_start:current_context_start+2000]
                if not current_context.strip(): current_context = context[:2000] # Fallback
                
                pass_q_count = 5 if p < pass_count - 1 else q_count - (p * 5)
                
                prompt = f"""Extract {pass_q_count} TRUE/FALSE facts from the text as JSON.
Text: {current_context}

RULES:
- BRIEF: Explanations MUST be under 10 words.
- Format:
{{
  "questions": [
    {{
      "statement": "fact",
      "answer": true/false,
      "explanation": "why (max 8 words)",
      "corrected_statement": "if false"
    }}
  ]
}}
JSON Output:"""
                
                # Faster calls with native JSON mode
                print(f"🔄 True/False Pass {p+1}/{pass_count} for {pass_q_count} questions...")
                # Use call_llama_optimized which has internal JSON formatting support
                response = self.call_llama_optimized(prompt, num_predict=1200, temperature=0.1, format="json")
                
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    try:
                        parsed = json.loads(json_match.group(0))
                        if "questions" in parsed:
                            all_questions.extend(parsed["questions"])
                    except:
                        print(f"⚠️ Pass {p+1} failed to parse JSON.")
            
            if all_questions:
                # Truncate to exact requested count if we got a few extra
                final_questions = all_questions[:q_count]
                return json.dumps({"questions": final_questions})
            
            # If we reached here, something went wrong across all passes
            print(f"❌ True/False AI Multi-Pass Failed.")
            return '{"questions": []}'

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
        if self.language == 'telugu':
            prompt = f"""మీరు ఒక తెలివైన తెలుగు ట్యూటర్. పాఠ్యపుస్తకం నుండి సేకరించిన సమాచారాన్ని ఉపయోగించి విద్యార్థికి సహాయం చేయండి.
            
విద్యార్థి ప్రశ్న: "{question}"

సంబంధిత పాఠ్యపుస్తక సమాచారం:
{context}

మీ పని (User instructions override constraints):
{task_instr}

ముఖ్య గమనిక: పాఠ్యపుస్తక శీర్షికలను (headings) మళ్ళీ చెప్పవద్దు. మీరు నేరుగా సమాధానంతో ప్రారంభించండి. ఇండెంటేషన్ వద్దు.
"""
        else:
            prompt = f"""You are an intelligent AI tutor. Use the provided textbook excerpt to help the student.
            
Student Question: "{question}"

Relevant Textbook Content:
{context}

Your task (User instructions override constraints):
{task_instr}

Note: Jump STRAIGHT into the answer. Do NOT repeat textbook headings or general greetings. Stay strictly on topic.
"""
        # Mode-specific settings
        config = {
            "brief": {"predict": 250, "timeout": 180},
            "standard": {"predict": 600, "timeout": 300},
            "premium": {"predict": 1200, "timeout": 600}
        }.get(mode, {"predict": 600, "timeout": 300})
        
        return self.call_llama(prompt, mode=mode, num_predict=config["predict"], timeout=config["timeout"])

    def chat_with_general_knowledge(self, question: str, mode: str = "standard") -> str:
        """AI response using general knowledge when textbook doesn't have info"""
        if not self.llm_available:
            if self.language == 'telugu':
                return "ఈ విషయం మీ పాఠ్యపుస్తకంలో లేదు. దయచేసి మీ ఉపాధ్యాయుడిని అడగండి."
            else:
                return "This topic is not in your textbook. Please ask your teacher."
        
        # 1. Define Basic instructions based on mode
        if mode == "brief":
            prompt_instr = "Give a very short educational summary."
        elif mode == "premium":
            prompt_instr = "Provide a deep, comprehensive educational response with examples."
        else:
            prompt_instr = "Provide a helpful educational response."

        if self.language == 'telugu':
            prompt = f"""A Telugu student asked: "{question}"
            
{prompt_instr}

Start with: "ఈ విషయం మీ పాఠ్యపుస్తకంలో లేదు, కానీ నేను వివరించగలను..."
and respond in Telugu.
"""
        else:
            prompt = f"""A student asked: "{question}"

{prompt_instr}

Start with: "This topic isn't in your textbook, but I can help explain..."
and respond in English.
"""
        # Mode-specific settings
        config = {
            "brief": {"predict": 250, "timeout": 180},
            "standard": {"predict": 600, "timeout": 300},
            "premium": {"predict": 1200, "timeout": 600} 
        }.get(mode, {"predict": 600, "timeout": 300})
        
        return self.call_llama(prompt, mode=mode, num_predict=config["predict"], timeout=config["timeout"])
    
    def call_llama(self, prompt: str, context: str = "", mode: str = "standard", num_predict: int = None, timeout: int = None, temperature: float = 0.7, num_ctx: int = 4096) -> str:
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
        if self.model_name == 'mistral':
            candidates.extend(['phi3', 'phi'])
        elif self.model_name == 'phi3':
            candidates.append('phi')
            
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
                            "temperature": temperature,
                            "top_p": 0.9,
                            "num_predict": num_predict,
                            "num_ctx": num_ctx
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

        # 3. Robust Prompt for Code-Block JSON with Verification Logic
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
            return json.dumps(valid_questions), [], "quiz"
            
        except Exception as e:
            print(f"❌ Quiz parsing failed: {e}")
            print(f"📄 Raw response preview: {response[:300]}...")
            return '{"error": "AI response was malformed. Please try again."}', [], "quiz"

    def call_llama_optimized(self, prompt: str, num_predict: int = 1500, temperature: float = 0.1, format: str = None) -> str:
        """Specialized LLM call for structured data generation."""
        try:
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": num_predict,
                    "num_ctx": 8192 # Increased for higher safety margin
                }
            }
            if format:
                payload["format"] = format

            response = requests.post(
                "http://localhost:11434/api/generate",
                json=payload,
                timeout=450 
            )
            if response.status_code == 200:
                text = response.json()['response'].strip()
                if not text:
                    print(f"⚠️ Ollama returned empty response for model {self.model_name}")
                return text
            else:
                print(f"❌ Ollama Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ call_llama_optimized Exception: {e}")
        return ""

    def generate_summary_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured, comprehensive summary of textbook content."""
        if not self.vectorstore:
            return "This textbook does not contain readable text to summarize.", [], "summary"

        # 1. Scope search by book/subject
        filter_dict = {}
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            # High-density retrieval for summary
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=10, # Get more chunks for a full summary
                filter=filter_dict
            )
            if not relevant_docs:
                return "This textbook does not contain readable text to summarize.", [], "summary"
                
            context = "\n\n".join([doc.page_content for doc in relevant_docs])[:4000]
        except Exception as e:
            print(f"⚠️ Summary context search failed: {e}")
            return "This textbook does not contain readable text to summarize.", [], "summary"

        # 2. Craft Prompt for Structured Summary
        # Use simple markers rather than complex markdown to ensure local logic is stable
        prompt = f"""You are a Content Strategist & Educator. Provide a structured, concise summary of the following content.

STRUCTURE:
1. Title: Create a professional title based on the book or chapter.
2. Overview: A 3-4 sentence paragraph explanation of the content.
3. Section Breakdown: Use clear Headings. Summarize major topics with paragraphs and bullet points.
4. Key Takeaways: 5-8 major bullet points.
5. Important Terms: List key terms with 1-line definitions.

RULES:
- Language must be simple and student-friendly.
- No markdown tables. Use headings (###) and lists (-).
- Explain all jargon.
- Do NOT hallucinate content outside the provided text.

CONTENT:
{context}

SUMMARY OUTPUT:"""

        print(f"📝 Generating summary for book(s): {selected_books or selected_subjects}...")
        start_time = time.time()
        
        # Call LLM with zero temperature for absolute determinism as requested
        response = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.0)
        
        duration = time.time() - start_time
        
        # Standardized logging as per requirements
        book_id_log = selected_books[0] if selected_books else "multiple"
        print(f"[SUMMARY] bookId={book_id_log} chunks={len(relevant_docs)} duration={duration:.2f}s")

        # Max Length Guard (12,000 characters)
        if len(response) > 12000:
            response = response[:11950] + "\n\n[This summary has been shortened for readability.]"

        if not response.strip():
            return "Unable to generate summary right now. Please try again.", [], "summary"

        return response, [], "summary"

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
        if mode == "truefalse":
            return self.generate_true_false_response(question, selected_subjects, selected_books)

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
