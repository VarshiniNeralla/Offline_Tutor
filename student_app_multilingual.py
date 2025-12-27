import streamlit as st
from tutor_backend_multilingual import AITextbookTutorMultilingualBackend
import os
import ui_styles

# Language configurations
LANGUAGES = {
    'english': {
        'name': 'English',
        'flag': '🇺🇸',
        'title': 'AI Textbook Tutor',
        'subtitle': 'Offline Intelligent Learning Assistant',
        'loading': 'Initializing Offline Neural Interface...',
        'no_textbooks': '📚 Library Empty. Please upload textbooks via Admin Console.',
        'system_unavailable': '⚠️ Neural Core Unavailable. Falling back to basic search.',
        'system_offline_mode': '🔄 Offline Mode Active',
        'select_subjects': 'Select Knowledge Base',
        'choose_textbooks': 'Active Textbooks:',
        'textbooks_help': 'Select sources for intelligence retrieval',
        'searching_in': 'Analyzing',
        'textbook_s': 'sources',
        'pages': 'pages',
        'voice_input': 'Voice Command (Offline)',
        'record_question': 'Speak now...',
        'record_help': 'Voice processing is local and private',
        'transcribing': 'Transcribing audio stream...',
        'you_said': 'Input:',
        'recognition_failed': 'Audio analysis failed. Use text input.',
        'sources_from': 'Knowledge Sources',
        'chat_placeholder': 'Ask your textbooks anything...',
        'searching_response': 'Processing query via local Llama 3.2...',
        'clear_chat': 'Reset Session',
        'how_to_use': 'User Manual',
        'voice_instructions': '''
        **Voice Command Protocol:**
        1. Engage 'Record' in sidebar
        2. State query clearly
        3. Processing is strictly local
        '''
    },
    'telugu': {
        'name': 'తెలుగు',
        'flag': '🇮🇳',
        'title': 'AI పాఠ్యపుస్తక ఉపాధ్యాయి',
        'subtitle': 'ఆఫ్‌లైన్ - మీ స్వంత AI ట్యూటర్',
        'loading': 'సిస్టమ్ లోడ్ అవుతోంది...',
        'no_textbooks': '📚 పుస్తకాలు లేవు. దయచేసి అడ్మిన్ ద్వారా అప్‌లోడ్ చేయండి.',
        'system_unavailable': '⚠️ సిస్టమ్ అందుబాటులో లేదు.',
        'system_offline_mode': '🔄 ఆఫ్‌లైన్ మోడ్',
        'select_subjects': 'సబ్జెక్టులు',
        'choose_textbooks': 'పుస్తకాలను ఎంచుకోండి:',
        'textbooks_help': 'శోధన కోసం ఎంపిక చేయండి',
        'searching_in': 'శోధిస్తోంది',
        'textbook_s': 'పుస్తకాలు',
        'pages': 'పేజీలు',
        'voice_input': 'వాయిస్ కమాండ్',
        'record_question': 'మాట్లాడండి...',
        'record_help': 'మీ వాయిస్ రికార్డ్ చేయండి',
        'transcribing': 'వ్రాస్తోంది...',
        'you_said': 'మీరు:',
        'recognition_failed': 'గుర్తించలేకపోయాను.',
        'sources_from': 'మూలాలు',
        'chat_placeholder': 'ఏదైనా అడగండి...',
        'searching_response': 'సమాధానం వెతుకుతోంది...',
        'clear_chat': 'రీసెట్ చేయండి',
        'how_to_use': 'సహాయం',
        'voice_instructions': '''
        **వాయిస్ సూచనలు:**
        1. రికార్డ్ నొక్కండి
        2. మాట్లాడండి
        '''
    }
}

def main():
    # Language selection at startup
    if 'selected_language' not in st.session_state:
        st.session_state.selected_language = None
    
    if st.session_state.selected_language is None:
        show_language_selection()
        return
    
    # Get current language config
    lang_config = LANGUAGES[st.session_state.selected_language]
    
    # Set page config
    st.set_page_config(
        page_title=lang_config['title'],
        page_icon="🤖",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # APPLY CUSTOM STYLES
    ui_styles.apply_custom_styles()
    
    # Main app interface
    show_main_interface(lang_config)

def show_language_selection():
    """Display language selection screen with premium UI"""
    st.set_page_config(
        page_title="Initialize AI Tutor",
        page_icon="🌍",
        layout="centered"
    )
    
    ui_styles.apply_custom_styles()
    
    # Use Hero Component
    ui_styles.render_hero("AI Textbook Tutor", "Choose your interface language")
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("<div style='height: 20px'></div>", unsafe_allow_html=True)
        
        # English button
        if st.button(
            f"🇺🇸 English Interface", 
            key="english_btn",
            use_container_width=True
        ):
            st.session_state.selected_language = 'english'
            st.rerun()
        
        st.markdown("<div style='height: 10px'></div>", unsafe_allow_html=True)
        
        # Telugu button  
        if st.button(
            f"🇮🇳 తెలుగు (Telugu)", 
            key="telugu_btn",
            use_container_width=True
        ):
            st.session_state.selected_language = 'telugu'
            st.rerun()
        
        st.markdown("<div style='height: 30px'></div>", unsafe_allow_html=True)
        
        st.markdown(
            """
            <div style='text-align: center; color: rgba(255,255,255,0.5); font-size: 0.9em;'>
            🔒 <b>Secure Offline Architecture</b><br>
            Running locally on Llama 3.2
            </div>
            """, 
            unsafe_allow_html=True
        )

def show_main_interface(lang_config):
    """Display the main app interface with offline status"""
    
    # Sidebar
    with st.sidebar:
        st.markdown("### ⚙️ Control Panel")
        
        # Status Card
        st.markdown("""
        <div style='background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);'>
            <small style='color: #888;'>SYSTEM STATUS</small><br>
            <span style='color: #00ff88;'>● ONLINE (LOCAL)</span>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button(f"🌍 {lang_config['name']} ▾", key="change_lang"):
            st.session_state.selected_language = None
            st.rerun()
            
        st.markdown("---")
    
    # Hero Title
    ui_styles.render_hero(lang_config['title'], lang_config['subtitle'])
    
    # Enhanced initialization
    if 'tutor' not in st.session_state or st.session_state.get('tutor_language') != st.session_state.selected_language:
        with st.spinner(lang_config['loading']):
            try:
                st.session_state.tutor = AITextbookTutorMultilingualBackend(st.session_state.selected_language)
                st.session_state.tutor_language = st.session_state.selected_language
            except Exception as e:
                st.error(f"System Failure: {e}")
                return
    
    tutor = st.session_state.tutor
    
    # Sidebar Check for textbooks
    if not tutor.textbooks:
        with st.sidebar:
            st.error(lang_config['no_textbooks'])
        st.info("👋 Welcome! Please upload textbooks in the Admin Panel to start.")

    # Sidebar for subject selection
    st.sidebar.markdown(f"### {lang_config['select_subjects']}")
    available_subjects = list(tutor.textbooks.keys())
    
    if available_subjects:
        selected_subjects = st.sidebar.multiselect(
            lang_config['choose_textbooks'],
            available_subjects,
            default=available_subjects,
            label_visibility="collapsed"
        )
        
        if selected_subjects:
             st.sidebar.caption(f"Searching {len(selected_subjects)} sources")
    else:
        selected_subjects = []

    # Voice input section
    transcribed_text = None
    if st.session_state.selected_language in ['telugu']:
        st.sidebar.markdown("---")
        st.sidebar.markdown(f"### {lang_config['voice_input']}")
        
        if hasattr(tutor, 'asr_available') and tutor.asr_available:
            audio_input = st.sidebar.audio_input(
                lang_config['record_question'],
                label_visibility="collapsed"
            )
            
            if audio_input is not None:
                transcription_placeholder = st.sidebar.empty()
                transcription_placeholder.info(f"🔄 {lang_config['transcribing']}")
                
                try:
                    transcribed_text = tutor.transcribe_audio(audio_input)
                    if transcribed_text and not transcribed_text.startswith("❌"):
                        transcription_placeholder.success(f"✓")
                        st.session_state.pending_voice_input = transcribed_text
                    else:
                        transcription_placeholder.error(f"❌")
                except Exception as e:
                    transcription_placeholder.error("Error")
        else:
            st.sidebar.warning("Voice module unavailable")

    # Initialize chat history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Display chat history
    
    # Custom container for chat to push it down a bit
    st.markdown("<div style='margin-bottom: 20px;'></div>", unsafe_allow_html=True)
    
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            
            # Audio
            if message["role"] == "assistant" and "audio_data" in message:
                st.audio(message["audio_data"], format="audio/mp3")
            
            # Sources
            if message["role"] == "assistant" and "sources" in message and message["sources"]:
                with st.expander(f"📚 {len(message['sources'])} References"):
                    for i, source in enumerate(message["sources"], 1):
                        st.markdown(f"<small>{i}. {source}</small>", unsafe_allow_html=True)

    # Handle voice input
    prompt = None
    if st.session_state.get('pending_voice_input'):
        st.info(f"🎤 {lang_config['you_said']} {st.session_state.pending_voice_input}")
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("📤 Send Voice Message", type="primary", use_container_width=True):
                prompt = st.session_state.pending_voice_input
                del st.session_state.pending_voice_input

    # Chat input
    if not st.session_state.get('pending_voice_input') and not prompt:
        prompt = st.chat_input(lang_config['chat_placeholder'])

    # Logic for response
    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    response, sources = tutor.get_response(prompt, selected_subjects)
                except Exception as e:
                    response = f"Analysis Error: {str(e)}"
                    sources = []

            st.markdown(response)

            if sources:
                with st.expander(f"📚 {len(sources)} References"):
                    for i, source in enumerate(sources, 1):
                        st.markdown(f"<small>{i}. {source}</small>", unsafe_allow_html=True)

            # Audio
            audio_data = None
            try:
                if hasattr(tutor, 'speak_text'):
                    audio_data = tutor.speak_text(response)
                    if audio_data:
                        st.audio(audio_data, format="audio/mp3")
            except:
                pass

        message_data = {
            "role": "assistant", 
            "content": response,
            "sources": sources
        }
        if audio_data:
            message_data["audio_data"] = audio_data
        
        st.session_state.messages.append(message_data)
        
        if 'pending_voice_input' in st.session_state:
            del st.session_state.pending_voice_input
        
        st.rerun()

    # Clear chat
    with st.sidebar:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button(f"🗑️ {lang_config['clear_chat']}", type="secondary"):
            st.session_state.messages = []
            if 'pending_voice_input' in st.session_state:
                del st.session_state.pending_voice_input
            st.rerun()

    # Footer credit
    st.markdown(
        """
        <div style='position: fixed; bottom: 10px; right: 10px; opacity: 0.3; font-size: 0.8em;'>
        AI Tutor Offline v2.0
        </div>
        """,
        unsafe_allow_html=True
    )

if __name__ == "__main__":
    main()
