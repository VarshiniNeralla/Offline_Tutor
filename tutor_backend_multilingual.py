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
# OFFLINE TTS instead of gTTS
try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None
import torch
try:
    import pyttsx3
except ImportError:
    pyttsx3 = None
import tempfile
import io
import re
import time


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
            
            # Check faster-whisper availability
            if WhisperModel is None:
                print("❌ faster-whisper not installed. Run: pip install faster-whisper")
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
        """Telugu transcription with script validation"""
        if not self.asr_available:
            return "❌ Telugu speech recognition not available"
        
        try:
            print("🎤 Transcribing with script validation...")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_file.getvalue())
                tmp_path = tmp_file.name
            
            # Transcribe with Telugu language forced
            segments, info = self.whisper_model.transcribe(
                tmp_path,
                beam_size=5,
                language="te",
                task="transcribe",
                temperature=0.0  # More deterministic
            )
            
            transcribed_text = " ".join([segment.text for segment in segments])
            print(f"✅ Transcribed: {transcribed_text[:100]}...")
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
            print(f"🔑 Generating Keywords: {question[:60]}...")
            kw_start = time.time()
            # Directly use call_llama_optimized with json format for better reliability
            prompt = f"""Extract 5-8 academic keywords with definitions from this text.
Text: {context_text[:3000]}
Format: {{"keywords": [{{"term": "...", "definition": "...", "level": "Basic", "sections": ["..."]}}]}}
JSON:"""
            response_text = self.call_llama_optimized(prompt, num_predict=1500, format="json")
            
            kw_duration = time.time() - kw_start
            print(f"⏱️ Keywords generation completed in {kw_duration:.2f}s")
            print(f"✅ Got response, mode=keywords, response length={len(response_text)}")

            # Final check
            if not response_text.strip().startswith('{'):
                 return '{"keywords": []}', sources, "keywords"

            return response_text, sources, "keywords"
            
        except Exception as e:
            print(f"❌ Keyword generation failed: {e}")
            return '{"keywords": []}', [], "keywords"

        
    def generate_true_false_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates True/False questions based on textbook context with multi-pass logic."""
        # 1. Scope search by book/subject
        filter_dict = {}
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}
            
        try:
            # Retrieve content for T/F generation
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=8, # Get a broader pool
                filter=filter_dict
            )
            
            if not relevant_docs:
                return '{"questions": []}', [], "truefalse"

            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            sources = [doc.metadata.get('source', 'Unknown') for doc in relevant_docs]

            # 2. Extract count from question (default to 5)
            import re
            count_match = re.search(r'(\d+)', question)
            q_count = int(count_match.group(1)) if count_match else 5
            
            # 3. Multi-Pass Strategy (Groups of 5)
            pass_count = (q_count + 4) // 5 
            all_questions = []
            
            for p in range(pass_count):
                pass_q_count = 5 if p < pass_count - 1 else q_count - (p * 5)
                print(f"🌀 True/False Pass {p+1}/{pass_count} for {pass_q_count} questions...")
                
                # Craft prompt for this pass
                current_context = context[p*1500 : (p+1)*1500 + 1000] # Sliding window
                if not current_context.strip(): current_context = context[:2500]
                
                # DEDUPLICATION: Tell AI what NOT to generate
                existing_topics = ", ".join([q.get('statement', '')[:30] for q in all_questions]) if all_questions else "None"
                
                prompt = f"""### SYSTEM:
Strict academic examiner.
Goal: Extract {pass_q_count} DIFFERENT True/False facts.
Constraint: DO NOT REPEAT these ideas: {existing_topics}

### FORMATTING RULES (CRITICAL):
1. STATEMENTS MUST BE FULL SENTENCES.
   - BAD: "Produced by oceans"
   - GOOD: "Oxygen is produced by oceans."
2. NO DUPLICATES.

### TEXT:
{current_context}

### OUTPUT (JSON):
{{
  "questions": [
    {{
      "statement": "Full sentence fact here.",
      "answer": true/false,
      "explanation": "Short reason (max 8 words)",
      "corrected_statement": "Adjustment if false"
    }}
  ]
}}"""
                
                retry_count = 0
                questions_added_in_pass = 0
                while questions_added_in_pass < pass_q_count and retry_count < max_retries_per_pass:
                    # Use phi3:mini for better T/F quality as per user request
                    response = self.call_llama_optimized(base_prompt, num_predict=1500, temperature=current_temp, format="json", model="phi3:mini")
                    
                    try:
                        # Clean response and parse
                        json_match = re.search(r'\{.*\}', response, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            if "questions" in parsed:
                                 # DEDUP FILTER
                                new_qs = []
                                for q in parsed["questions"]:
                                    # Simple duplicate check
                                    is_dup = False
                                    for old_q in all_questions:
                                        if q['statement'].lower().strip() == old_q['statement'].lower().strip():
                                            is_dup = True
                                            break
                                    if not is_dup:
                                        new_qs.append(q)
                                
                                all_questions.extend(new_qs)
                                questions_added_in_pass += len(new_qs)

                                if len(all_questions) >= q_count: # Hard break if we have enough questions overall
                                    break
                                
                                if questions_added_in_pass == 0:
                                    print(f"⚠️ No unique questions found in this attempt. Increasing temperature... (Retry {retry_count+1}/{max_retries_per_pass})")
                                    current_temp = min(current_temp * 1.5, 1.0) # Exponential temperature increase, max 1.0
                                    retry_count += 1
                                    # Add a hint to the prompt for more variety
                                    prompt += "\n\n### IMPORTANT: Please explore DIFFERENT topics than previous questions."
                                else:
                                    # Reset temperature and retry count if progress was made
                                    current_temp = initial_temperature
                                    retry_count = 0
                            else:
                                print(f"⚠️ Pass {p+1} failed to parse JSON (no 'questions' key). Retrying...")
                                retry_count += 1
                                current_temp = min(current_temp * 1.5, 1.0)
                        else:
                            print(f"⚠️ Pass {p+1} failed to parse JSON (no match). Retrying...")
                            retry_count += 1
                            current_temp = min(current_temp * 1.5, 1.0)
                    except Exception as e:
                        print(f"⚠️ Pass {p+1} failed to parse JSON: {e}. Retrying...")
                        retry_count += 1
                        current_temp = min(current_temp * 1.5, 1.0)
                
                if len(all_questions) >= q_count: # Break outer loop if enough questions are generated
                    break

            # 4. Return results
            final_data = {"questions": all_questions[:q_count]}
            final_json = json.dumps(final_data)
            print(f"✅ Got response, mode=truefalse, response length={len(final_json)}")
            return final_json, sources, "truefalse"
            
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
        fallback_order = ['qwen2.5:1.5b', 'llama3.2:1b', 'phi3:mini', 'phi3', 'llama3.2', 'mistral']
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
  ]
}}"""
            # Use JSON mode for absolute enforcement
            response = self.call_llama_optimized(prompt, num_predict=1500, format="json")
            
            # CRITICAL FIX: Extract JSON even if AI adds preamble (extra safety)
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                response = json_match.group(0)
            
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

        print(f"📚 Generating Summary: {question[:60]}...")
        summary_start = time.time()
        
        # Call LLM with zero temperature for absolute determinism
        response = self.call_llama_optimized(prompt, num_predict=2000, temperature=0.0)
        
        summary_duration = time.time() - summary_start
        print(f"⏱️ Summary generation completed in {summary_duration:.2f}s")
        print(f"✅ Got response, mode=summary, response length={len(response)}")

        # Max Length Guard (12,000 characters)
        if len(response) > 12000:
            response = response[:11950] + "\n\n[This summary has been shortened for readability.]"

        if not response.strip():
            return "Unable to generate summary right now. Please try again.", [], "summary"

        return response, [], "summary"

    def generate_flashcards_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a list of high-quality flashcards from textbook context."""
        print(f"🗂️ Generating Flashcards: {question[:60]}...")
        flash_start = time.time()

        # 1. Search for broader context to get enough cards
        filter_dict = None
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            # Reverting k to 22 for speed balance (25/35 was too slow)
            relevant_docs = self.vectorstore.similarity_search(question, k=22, filter=filter_dict)
            base_context_paragraphs = [doc.page_content for doc in relevant_docs]
            # Verify we have content
            if not base_context_paragraphs:
                 return [], [], "error"
            
            # Full context for reference
            full_context_str = "\n\n".join(base_context_paragraphs)
        except Exception as e:
            print(f"⚠️ Vector search failed for Flashcards: {e}")
            return [], [], "error"

        # 2. Extract card count from question if provided (e.g. "Generate 20 cards")
        card_count = 10
        import re
        match = re.search(r'(\d+)', question)
        if match:
            card_count = int(match.group(1))
        
        # Limit count for local AI stability
        card_count = min(max(card_count, 5), 30)

        # 3. Robust While-Loop Strategy
        all_flashcards = []
        batch_size = 5
        # Calculate passes needed, but be willing to add an extra pass if dedup reduces count
        estimated_passes = (card_count + batch_size - 1) // batch_size
        max_total_passes = estimated_passes + 2 # Allow 2 extra passes to fill gaps
        
        print(f"🌀 Flashcards Generation: Target {card_count} cards (allowing up to {max_total_passes} passes)...")

        for pass_idx in range(max_total_passes):
            if len(all_flashcards) >= card_count:
                break
                
            needed = min(batch_size, card_count - len(all_flashcards))
            print(f"   🔹 Pass {pass_idx+1}: Need {needed} more (Current: {len(all_flashcards)}/{card_count})")
            
            # Simple Exclusion List
            current_excludes = ", ".join([c['front'][:40] for c in all_flashcards]) if all_flashcards else "None"
            
            # SHUFFLE STRATEGY (Better than Sliding Window for small texts)
            # Pass 1: Original Order (Logical flow)
            # Pass 2+: Random Shuffle (Breaks attention bias to start of text)
            
            import random
            current_paragraphs = base_context_paragraphs[:] # Copy
            if pass_idx > 0:
                random.shuffle(current_paragraphs)
            
            current_context_text = "\n\n".join(current_paragraphs)
            
            prompt = f"""### INSTRUCTION:
You are an expert educational content creator. Your task is to generate {needed + 2} unique, high-quality flashcards based ONLY on the provided textbook context.

### GUIDELINES:
- Create {needed + 2} distinct cards.
- Focus on key terms, definitions, and facts.
- Avoid repeating facts from: {current_excludes}
- Response MUST be a valid JSON array.
- Keep definitions SHORT (under 15 words).

### TEXTBOOK CONTEXT:
{current_context_text}

### EXAMPLE JSON (Pattern to follow):
[
  {{
    "id": 1, 
    "front": "What is the largest planet in the solar system?", 
    "back": "Jupiter", 
    "hint": "Gas giant", 
    "importance": "high"
  }},
  {{
    "id": 2, 
    "front": "Which planet is known as the Red Planet?", 
    "back": "Mars", 
    "hint": "Fourth planet", 
    "importance": "medium"
  }}
]

### FLASHCARDS OUTPUT (Generate {needed} cards about the TEXTBOOK CONTEXT):"""

            # Call AI for this batch - Use Qwen with standard temp
            # Higher temp (0.2) to avoid repetitive loops, but low enough for JSON stability
            response_text = self.call_llama_optimized(prompt, num_predict=1500, temperature=0.2)
            
            # Parse JSON with robustness for this batch
            try:
                # 1. Basic cleaning
                clean_text = response_text.strip()
                if "```json" in clean_text:
                    clean_text = clean_text.split("```json")[-1].split("```")[0]
                elif "```" in clean_text:
                    clean_text = clean_text.split("```")[-1].split("```")[0]
                
                start_idx = clean_text.find('[')
                end_idx = clean_text.rfind(']')
                
                if start_idx != -1 and end_idx != -1:
                    json_blob = clean_text[start_idx:end_idx+1]
                    
                    # 2. JSON Repair Logic
                    import re
                    # Remove trailing commas
                    json_blob = re.sub(r',\s*([\]}])', r'\1', json_blob)
                    # Add missing commas between objects
                    json_blob = re.sub(r'}\s*{', '}, {', json_blob)
                    
                    import json
                    batch_cards = json.loads(json_blob)
                    
                    cards_added_in_pass = 0
                    
                    # Deduplication (Exact + Loose Substring)
                    # We dropped the expensive Semantic Check because it was deleting too much
                    seen_fronts = {re.sub(r'[^\w\s]', '', c['front'].lower().strip()) for c in all_flashcards}
                    
                    for card in batch_cards:
                        if isinstance(card, dict) and 'front' in card and 'back' in card:
                            f_norm = re.sub(r'[^\w\s]', '', card['front'].lower().strip())
                            
                            # Check 1: Exact Front Match
                            if f_norm in seen_fronts:
                                print(f"⚠️ Redundant Flashcard skipped: {card['front'][:30]}...")
                                continue
                            
                            # Check 2: Keyword Similarity (Semantic Dedup)
                            # Simple "Bag of Words" overlap to catch rephrasing
                            # e.g. "What is largest planet?" vs "Which is the biggest planet?"
                            is_suspicious = False
                            
                            def get_keywords(text):
                                # Simple tokenizer: lowercase, alpha only, ignore short words
                                return {w for w in re.split(r'\W+', text.lower()) if len(w) > 3}
                            
                            new_kw = get_keywords(card['front'])
                            
                            for existing in all_flashcards:
                                old_kw = get_keywords(existing['front'])
                                # Jaccard-ish overlap
                                if not new_kw or not old_kw: continue
                                
                                overlap = len(new_kw & old_kw)
                                # If >75% of the new card's keywords are already in an old card, it's a dup
                                if overlap / len(new_kw) > 0.75:
                                    print(f"⚠️ Semantic Duplicate detected: '{card['front'][:30]}...' ~= '{existing['front'][:30]}...'")
                                    is_suspicious = True
                                    break
                            
                            if is_suspicious:
                                continue
                                
                            card['id'] = len(all_flashcards) + 1
                            all_flashcards.append(card)
                            seen_fronts.add(f_norm)
                            cards_added_in_pass += 1
                            
                            if len(all_flashcards) >= card_count:
                                break
                    
                    print(f"✅ Pass {pass_idx+1}: Added {cards_added_in_pass} new cards.")
                    
                else:
                    print(f"⚠️ Pass {pass_idx+1}: No JSON array found.")
                    
            except Exception as e:
                print(f"❌ JSON Parse failed in Pass {pass_idx+1}: {e}")

        print(f"✅ Generated {len(all_flashcards)} valid cards")

        if not all_flashcards:
            return [], [], "error"

        return all_flashcards, [], "flashcards"

    def generate_oral_test_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """Generates a structured list of questions for an oral exam from textbook context."""
        print(f"🎙️ Generating Oral Test Questions: {question[:60]}...")
        oral_start = time.time()

        # 1. Broad context search
        filter_dict = None
        if selected_books:
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            filter_dict = {"subject": {"$in": selected_subjects}}

        try:
            relevant_docs = self.vectorstore.similarity_search(question, k=15, filter=filter_dict)
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            if not context or len(context.strip()) < 100:
                print("⚠️ Insufficient context found for Oral Test questions.")
                return [], [], "error"
        except Exception as e:
            print(f"⚠️ Vector search failed for Oral Test: {e}")
            return [], [], "error"

        # 2. Extract question count
        q_count = 5
        import re
        match = re.search(r'(\d+)', question)
        if match:
            q_count = int(match.group(1))
        
        q_count = min(max(q_count, 3), 15) # Limit for stability

        # 3. Generation Logic (Single or Two-Pass depending on count)
        all_questions = []
        batch_size = 5
        num_passes = (q_count + batch_size - 1) // batch_size

        for pass_idx in range(num_passes):
            current_batch_count = min(batch_size, q_count - len(all_questions))
            
            # Sub-retry loop for this specific pass
            max_pass_retries = 3 # Increased retries
            for retry_idx in range(max_pass_retries):
                # Clean prompt to remove starting "3 " or similar counts
                topic_hint = re.sub(r'^\d+\s*', '', question.replace("Generate ", "").replace("oral test questions for ", "").strip())
                
                print(f"🌀 Oral Test Pass {pass_idx + 1}/{num_passes} (Attempt {retry_idx + 1}/{max_pass_retries}) for {current_batch_count} questions (Topic: {topic_hint})")

                prompt = f"""### SYSTEM:
You are an academic examiner. Generate ONLY from the context.
NO Biology/Science if context is Geography.

### INSTRUCTION:
Generate {current_batch_count} DIFFERENT questions about: "{topic_hint}".
Base them ONLY on the TEXTBOOK CONTEXT below.

### CONSTRAINTS:
- Topic: {topic_hint}
- Diversify: Covered topics so far: {", ".join([q['question'][:30] for q in all_questions]) if all_questions else "None"}. Do NOT repeat these.
- Focus: Pick {current_batch_count} DIFFERENT facts/terms from the context.
- Uniqueness: Each question must have a unique answer.

### TEXTBOOK CONTEXT:
{context[:4000]}

### EXAMPLE JSON (STRICT FORMAT):
[
  {{
    "question": "Explain the process of photosynthesis.",
    "sample_answer": "Plants convert sunlight into energy.",
    "rubric": "Mentions sunlight, chlorophyll, and energy conversion."
  }}
]

### ORAL TEST QUESTIONS OUTPUT (JSON):"""

                response_text = self.call_llama_optimized(prompt, num_predict=800, temperature=0.1, format="json") # Reduced from 2000, added format="json"
                
                try:
                    # Robust JSON extraction
                    import json
                    import re
                    
                    json_data = None
                    try:
                        # Attempt 1: Direct parse
                        json_data = json.loads(response_text)
                    except:
                        # Attempt 2: Extract block
                        start_idx = response_text.find('[')
                        end_idx = response_text.rfind(']')
                        if start_idx != -1 and end_idx != -1:
                            json_blob = response_text[start_idx:end_idx+1]
                            json_data = json.loads(json_blob)
                        else:
                            # Attempt 3: Look for object if no list
                            start_obj = response_text.find('{')
                            end_obj = response_text.rfind('}')
                            if start_obj != -1 and end_obj != -1:
                                json_blob = response_text[start_obj:end_obj+1]
                                json_data = json.loads(json_blob)
                    
                    if json_data:
                        # Normalize to list
                        batch_qs = []
                        if isinstance(json_data, list):
                            batch_qs = json_data
                        elif isinstance(json_data, dict):
                            # Handle common patterns like {"questions": [...]} or {"oral_test": [...]}
                            for key in ["questions", "oral_test", "data", "result"]:
                                if key in json_data and isinstance(json_data[key], list):
                                    batch_qs = json_data[key]
                                    break
                            if not batch_qs:
                                # Could be a single object
                                if 'question' in json_data:
                                    batch_qs = [json_data]

                        # Validation & Integration
                        pass_success = False
                        new_batch = []
                        # Pre-calculate normalized forms of existing questions for efficiency
                        seen_q_norms = {re.sub(r'[^\w\s]', '', prev['question'].lower().strip()) for prev in all_questions}
                        seen_a_norms = {prev['sample_answer'].lower().strip()[:40] for prev in all_questions}
                        
                        for q in batch_qs:
                            if isinstance(q, dict) and 'question' in q and 'sample_answer' in q:
                                # Normalization for duplicate detection
                                q_norm = re.sub(r'[^\w\s]', '', q['question'].lower().strip())
                                a_norm = q['sample_answer'].lower().strip()[:40] # Check first 40 chars of answer
                                
                                # Check against already saved questions AND currently adding ones
                                pending_q_norms = {re.sub(r'[^\w\s]', '', p['question'].lower().strip()) for p in new_batch}
                                pending_a_norms = {p['sample_answer'].lower().strip()[:40] for p in new_batch}
                                
                                # If question phrasing OR the answer is a duplicate, skip it
                                if q_norm in seen_q_norms or q_norm in pending_q_norms:
                                    print(f"⚠️ redundant phrasing: {q['question'][:30]}...")
                                    continue
                                if a_norm in seen_a_norms or a_norm in pending_a_norms:
                                    print(f"⚠️ redundant fact: same answer as previous question.")
                                    continue
                                    
                                q['id'] = len(all_questions) + len(new_batch) + 1
                                new_batch.append(q)
                        
                        if new_batch:
                            all_questions.extend(new_batch)
                            pass_success = True
                        
                        if pass_success:
                            if len(batch_qs) < current_batch_count:
                                print(f"⚠️ AI generated only {len(batch_qs)}/{current_batch_count} questions. Retrying pass...")
                                pass_success = False
                                # Continue to next retry_idx
                            else:
                                break # Success! Exit retry loop
                        else:
                            print(f"⚠️ Pass {pass_idx+1}, Attempt {retry_idx+1}: Valid JSON but missing required fields.")
                    else:
                        print(f"⚠️ Pass {pass_idx+1}, Attempt {retry_idx+1}: Could not find JSON in response.")
                        print(f"DEBUG RAW RESPONSE: {response_text[:200]}...")
                except Exception as e:
                    print(f"❌ JSON Parse failed in Oral Test Pass {pass_idx+1}, Attempt {retry_idx+1}: {e}")
                    # print(f"DEBUG RAW RESPONSE: {response_text[:200]}...")

            # --- FALLBACK: If batch generation failed to reach count, generate one-by-one ---
            remaining_to_fill = current_batch_count - len(new_batch)
            if remaining_to_fill > 0:
                print(f"🔄 Pass {pass_idx+1} incomplete ({len(new_batch)}/{current_batch_count}). Falling back to one-by-one generation for {remaining_to_fill} questions...")
                for f_idx in range(remaining_to_fill):
                    print(f"   🔹 Generating individual fallback question {f_idx + 1}/{remaining_to_fill}...")
                    
                    fallback_prompt = f"""### SYSTEM:
Academic examiner. Topic: {topic_hint}. Context ONLY.
AVOID repeating: {", ".join([q['question'][:30] for q in all_questions + new_batch]) if (all_questions or new_batch) else "None"}

### INSTRUCTION:
Generate ONE unique oral exam question about: "{topic_hint}".
Base it ONLY on the TEXTBOOK CONTEXT.
Cover a different fact than: {", ".join([q['question'][:30] for q in all_questions + new_batch]) if (all_questions or new_batch) else "None"}.

### FORMAT:
{{
  "question": "[Unique question]",
  "sample_answer": "[Canonical answer]",
  "type": "explanation"
}}

### TEXTBOOK CONTEXT:
{context[:3000]}

### OUTPUT (JSON OBJECT ONLY):"""
                    
                    try:
                        f_response = self.call_llama_optimized(fallback_prompt, num_predict=300, temperature=0.3, format="json")
                        # Simple extract object
                        s = f_response.find('{')
                        e_idx = f_response.rfind('}')
                        if s != -1 and e_idx != -1:
                            f_item = json.loads(f_response[s:e_idx+1])
                            if 'question' in f_item and 'sample_answer' in f_item:
                                f_item['id'] = len(all_questions) + 1
                                all_questions.append(f_item)
                                print(f"   ✅ Fallback question generated successfully.")
                    except Exception as fe:
                        print(f"   ❌ Fallback failed: {fe}")

        oral_duration = time.time() - oral_start
        print(f"⏱️ Total Oral Test generation completed in {oral_duration:.2f}s")
        
        if not all_questions:
            return [], [], "error"

        return all_questions, [], "oral_test"

    def transcribe_file(self, audio_path):
        """Transcribe an audio file using the local Whisper model."""
        if not hasattr(self, 'whisper_model') or self.whisper_model is None:
            self.setup_telugu_asr_offline()
        
        if not self.asr_available:
            return None, "ASR not available"
            
        try:
            print(f"🎤 Transcribing audio: {audio_path}")
            # Use English if not specified, but Whisper detects automatically
            segments, info = self.whisper_model.transcribe(audio_path, beam_size=5)
            transcript = " ".join([segment.text for segment in segments]).strip()
            print(f"📄 Transcription complete: {transcript[:50]}...")
            return transcript, None
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return None, str(e)

    def analyze_oral_transcript(self, question, sample_answer, transcript):
        """AI Auto-Review of Oral Test transcript using LLM comparison."""
        if not transcript or len(transcript.strip()) < 2:
            return {
                "score": 1,
                "feedback": "No clear response detected in the audio.",
                "confidence": "high",
                "keywords_detected": []
            }

        # Step 1: Extract Keywords from Sample Answer for Coverage Analysis (Internal LLM step or simple regex)
        # We'll ask the LLM to do it as part of the main analysis for efficiency
        
        prompt = f"""### INSTRUCTION:
You are an expert oral exam reviewer. Your task is to evaluate a student's spoken response (transcript) against a canonical sample answer.

### EVALUATION CRITERIA:
1. Accuracy: Does the transcript contain the correct information?
2. Completeness: Were the key concepts from the sample answer mentioned?
3. Keywords: Did the student use the essential terms?

### INPUT:
- QUESTION: {question}
- CANONICAL ANSWER: {sample_answer}
- STUDENT TRANSCRIPT: {transcript}

### OUTPUT FORMAT (STRICT JSON):
{{
  "score": (Integer 1-5),
  "feedback": (Short, encouraging feedback string),
  "confidence": ("low" | "medium" | "high"),
  "keywords_detected": [List of key terms found in the transcript]
}}

### ANALYSIS:"""

        try:
            response_text = self.call_llama_optimized(prompt, num_predict=1000, temperature=0.1)
            
            # Robust JSON extraction
            import json
            import re
            
            clean_text = response_text.strip()
            # Handle markdown code blocks
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[-1].split("```")[0]
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[-1].split("```")[0]
            
            start_idx = clean_text.find('{')
            end_idx = clean_text.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_blob = clean_text[start_idx:end_idx+1]
                # Repair trailing commas and other common issues
                json_blob = re.sub(r',\s*([\]}])', r'\1', json_blob)
                analysis = json.loads(json_blob)
                
                # Validation
                if 'score' not in analysis: analysis['score'] = 3
                if 'feedback' not in analysis: analysis['feedback'] = "Review complete."
                if 'confidence' not in analysis: analysis['confidence'] = "medium"
                if 'keywords_detected' not in analysis: analysis['keywords_detected'] = []
                
                return analysis
            else:
                return {
                    "score": 3,
                    "feedback": "AI was unable to generate a detailed review, but the response was recorded.",
                    "confidence": "low",
                    "keywords_detected": []
                }
        except Exception as e:
            print(f"❌ AI Analysis error: {e}")
            return {
                "score": 0,
                "feedback": f"Review engine error: {str(e)}",
                "confidence": "low",
                "keywords_detected": []
            }

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
        if mode == "flashcards":
            return self.generate_flashcards_response(question, selected_subjects, selected_books)
        if mode == "oral_test":
            return self.generate_oral_test_response(question, selected_subjects, selected_books)

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
