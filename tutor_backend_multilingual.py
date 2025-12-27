import os
import json
import warnings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import requests
from faster_whisper import WhisperModel
import torch
import pyttsx3  # OFFLINE TTS instead of gTTS
import tempfile
import io
import re
import time


warnings.filterwarnings('ignore')

class AITextbookTutorMultilingualBackendOffline:
    def __init__(self, language='telugu'):
        print(f"🚀 Initializing Offline AI Tutor ({language})...")
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
        print("✅ Offline AI Tutor Ready!")
    
    def setup_embeddings_offline(self):
        """Setup embeddings with proper offline caching"""
        try:
            print("📥 Ensuring embedding model is fully downloaded...")
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
                print("✅ Offline embeddings ready!")
                
            except Exception as offline_error:
                print(f"⚠️ Offline mode failed: {offline_error}")
                
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
            print(f"❌ Embeddings setup failed: {e}")
            raise e
        
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

    def chat_with_textbook_context(self, question: str, context: str) -> str:
        """AI response with textbook context - SMART GENERATION"""
        if not self.llm_available:
            if self.language == 'telugu':
                return f"పాఠ్యపుస్తక సమాచారం:\n\n{context}\n\nమరింత వివరాలు కావాలంటే దయచేసి నిర్దిష్ట ప్రశ్న అడగండి."
            else:
                return f"From your textbook:\n\n{context}\n\nAsk a specific question if you need more details."
        
        if self.language == 'telugu':
            prompt = f"""మీరు ఒక తెలివైన మరియు ప్రోత్సాహకరమైన తెలుగు ట్యూటర్. విద్యార్థికి ఒక అంశం గురించి లోతుగా అర్థం చేసుకోవడానికి సహాయం చేయడం మీ లక్ష్యం. దీని కోసం మీరు పాఠ్యపుస్తకం నుండి సేకరించిన సమాచారాన్ని ఉపయోగిస్తున్నారు.

    విద్యార్థి ప్రశ్న: "{question}"

    సంబంధిత పాఠ్యపుస్తక సమాచారం:
    {context}

    మీ పని:
    1.  **ప్రత్యక్ష సమాధానం:** మొదట, విద్యార్థి ప్రశ్నకు స్పష్టమైన, ప్రత్యక్ష సమాధానం ఇవ్వండి. సమాధానం కోసం మీరు పైన ఇచ్చిన పాఠ్యపుస్తకంలోని సమాచారాన్ని ఉపయోగించండి.
    2.  **వివరమైన వివరణ:** సంక్లిష్టమైన ఆలోచనలను సులభంగా అర్థమయ్యేలా, సాధారణ పదాలలో విడదీసి వివరించండి.
    3.  **నిజ జీవిత ఉదాహరణలు:** విద్యార్థికి ఆ అంశం సులభంగా అర్థం కావడానికి, కనీసం ఒక నిజ జీవిత ఉదాహరణ లేదా పోలికను జోడించండి.
    4.  **కీలక అంశాల సారాంశం:** ప్రధాన అంశాలను ఒక చిన్న జాబితాలో లేదా ఒక పేరాగ్రాఫ్‌లో సంక్షిప్తంగా చెప్పండి.
    5.  **ఆలోచింపజేసే ప్రశ్న:** విద్యార్థి అవగాహనను పరీక్షించడానికి, లేదా వారు ఆ అంశాన్ని కొత్త కోణంలో ఆలోచించేలా ప్రోత్సహించడానికి ఒక ఆలోచింపజేసే ప్రశ్నతో ముగించండి.
    6.  **శైలి:** మొత్తం సమాధానంలో స్నేహపూర్వక, ప్రోత్సాహకరమైన శైలిని కొనసాగించండి.

    సమాధానం తెలుగులో మాత్రమే ఇవ్వండి. మొత్తం సమాధానం ఒకే, స్పష్టమైన మరియు చక్కని నిర్మాణం గల వ్యాసంగా ఉండాలి.
    """
        else:
            prompt = f"""You are an intelligent and encouraging tutor. Your goal is to help a student deeply understand a topic by using a provided textbook excerpt.

    Student Question: "{question}"

    Relevant Textbook Content:
    {context}

    Your task:
    1.  **Direct Answer:** Start with a clear, direct answer to the student's question, drawing from the provided text.
    2.  **Detailed Explanation:** Expand on the answer by explaining the core concepts in your own words. Break down complex ideas into simple, digestible parts.
    3.  **Real-World Application:** Provide at least one clear, real-world example or analogy that helps the student connect the abstract concept to something familiar.
    4.  **Key Takeaways:** Summarize the main points in a simple list or a concise paragraph to reinforce learning.
    5.  **Critical Thinking Follow-Up:** End with a thought-provoking question that prompts the student to think about the topic in a new way or apply the concept. This should go beyond simple recall.
    6.  **Tone:** Maintain a warm, encouraging, and easy-to-read tone throughout the response.

    Respond ONLY in English. Make the entire response a single, coherent, and well-structured piece of text.
    """
        
        return self.call_llama(prompt, "")

    def chat_with_general_knowledge(self, question: str) -> str:
        """AI response using general knowledge when textbook doesn't have info"""
        if not self.llm_available:
            if self.language == 'telugu':
                return "ఈ విషయం మీ పాఠ్యపుస్తకంలో లేదు. దయచేసి మీ ఉపాధ్యాయుడిని అడగండి."
            else:
                return "This topic is not in your textbook. Please ask your teacher."
        
        if self.language == 'telugu':
            prompt = f"""A Telugu student asked: "{question}"

    This question is not covered in their textbook. Use your general knowledge to provide a helpful educational response in Telugu.

    Start with: "ఈ విషయం మీ పాఠ్యపుస్తకంలో లేదు, కానీ నేను వివరించగలను..."

    Then, structure your response to be as helpful as possible:
    1.  **స్పష్టమైన వివరణ:** ఆ అంశం గురించి స్పష్టమైన, కానీ సంక్షిప్తమైన వివరణ ఇవ్వండి.
    2.  **సాధారణ ఉదాహరణలు:** ఒకటి లేదా రెండు సులభంగా అర్థమయ్యే ఉదాహరణలను ఉపయోగించి భావనను వివరించండి.
    3.  **పాఠాలకు అనుసంధానం:** ఈ అంశం వారి సాధారణ అధ్యయనాలకు లేదా ప్రపంచానికి ఎలా సంబంధం కలిగి ఉంటుందో క్లుప్తంగా వివరించండి.
    4.  **ఉపాధ్యాయుని సూచన:** మరింత లోతైన వివరణ కోసం వారి ఉపాధ్యాయుడితో చర్చించమని సున్నితంగా సూచించండి.
    5.  **తదుపరి ప్రశ్న:** మీకు ఇంకా ఏమైనా ప్రశ్నలు ఉన్నాయా అని అడగండి.

    సమాధానం తెలుగులో మాత్రమే ఇవ్వండి.
    """
        else:
            prompt = f"""A student asked: "{question}"

    This question is not covered in their textbook. Use your general knowledge to provide a helpful educational response.

    Start with: "This topic isn't in your textbook, but I can help explain..."

    Then, structure your response to be as helpful as possible:
    1.  **Clear Explanation:** Provide a concise but comprehensive explanation of the topic.
    2.  **Simple Examples:** Use 1-2 easy-to-understand examples to illustrate the concept.
    3.  **Connection to Studies:** Briefly explain why this topic is relevant to their general studies or the world around them.
    4.  **Teacher Recommendation:** Gently suggest they discuss this with their teacher for a deeper, more tailored explanation.
    5.  **Follow-Up:** End by asking if they have any other questions.

    Respond ONLY in English.
    """
        
        return self.call_llama(prompt, "")
    
    def call_llama(self, prompt: str, context: str = "") -> str:
        """Make API call to local Ollama with RUNTIME FALLBACK and RECOVERY"""
        
        # Priority: Current model -> phi3 -> phi (lighter models first for stability)
        candidates = [self.model_name]
        if self.model_name == 'mistral':
            candidates.extend(['phi3', 'phi'])
        elif self.model_name == 'phi3':
            candidates.append('phi')
            
        # Deduplicate
        candidates = list(dict.fromkeys(candidates))
        
        last_error = ""
        
        for model in candidates:
            print(f"🤖 Generating with {model}...")
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
                            "num_predict": 300
                        }
                    },
                    timeout=300 
                )
                
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    if model != self.model_name:
                        print(f"⚠️ Switched to {model} for stability")
                        self.model_name = model
                    
                    print(f"⏱️ Response generated in {duration:.2f}s using {model}")
                    return response.json()['response']
                else:
                    last_error = f"Error {response.status_code}"
                    # Check for memory errors specifically
                    try:
                        err_detail = response.json().get('error', '')
                        if 'memory' in err_detail.lower():
                            last_error = "Out of system memory"
                    except: pass
                    
                    print(f"❌ {model} failed ({duration:.2f}s): {last_error}")
                    # Give Ollama a moment to recover from 500/Memory error
                    time.sleep(2) 
            
            except Exception as e:
                duration = time.time() - start_time
                print(f"❌ {model} failed ({duration:.2f}s): {e}")
                last_error = str(e)
                time.sleep(2)
                continue
                
        return f"❌ All AI models failed. Last error: {last_error}"
    
    def get_response(self, question: str, selected_subjects: list = None, selected_books: list = None):
        """SMART response routing with book-level scoping support"""
        print(f"🧠 Processing question: {question[:50]}...")
        
        no_textbook_msg = "పాఠ్యపుస్తకాలు లోడ్ చేయబడలేదు!" if self.language == 'telugu' else "No textbooks loaded!"
        
        if not self.vectorstore:
            return no_textbook_msg, []
        
        # STEP 1: Check if it's general conversation (no textbook search needed)
        if self.is_general_conversation(question):
            print("💬 Detected general conversation - no textbook search")
            response = self.chat_with_ai_directly(question)
            return response, []
        
        # STEP 2: Search textbook with correct scoping
        print(f"🔍 Searching textbook... (Books: {selected_books}, Subjects: {selected_subjects})")
        
        filter_dict = None
        if selected_books:
            # Explicit book scoping
            filter_dict = {"book_id": {"$in": selected_books}}
        elif selected_subjects:
            # Fallback to subject scoping
            filter_dict = {"subject": {"$in": selected_subjects}}
        
        try:
            relevant_docs = self.vectorstore.similarity_search(
                question, 
                k=2,
                filter=filter_dict
            )
        except Exception as e:
            print(f"⚠️ Search filter failed ({e}), falling back to unfiltered search")
            relevant_docs = self.vectorstore.similarity_search(question, k=2)
        
        # STEP 3: Smart routing based on search results
        if relevant_docs and len(relevant_docs[0].page_content.strip()) > 100:
            # Found good textbook content - use AI to process it
            print("📚 Found textbook content - generating AI analysis...")
            # Limit context size to prevent timeouts
            full_context = "\n\n".join([doc.page_content for doc in relevant_docs])
            context = full_context[:2500] 
            ai_response = self.chat_with_textbook_context(question, context)
            
            sources = []
            page_text = "పేజీ" if self.language == 'telugu' else "Page"
            for doc in relevant_docs:
                page_num = doc.metadata.get('page', 'Unknown')
                subject = doc.metadata.get('subject', 'Unknown')
                sources.append(f"{subject} - {page_text} {page_num}")
            
            return ai_response, sources
        
        else:
            # No relevant textbook content - use AI general knowledge
            print("🧠 No textbook content found - using AI general knowledge...")
            ai_response = self.chat_with_general_knowledge(question)
            return ai_response, []

# For backward compatibility with your existing UI files
AITextbookTutorMultilingualBackend = AITextbookTutorMultilingualBackendOffline
