import streamlit as st
from admin_backend import AITextbookAdminBackendOffline
import pandas as pd
import ui_styles

st.set_page_config(
    page_title="Admin Console - AI Tutor",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Language options
LANGUAGE_OPTIONS = {
    'english': {'name': 'English', 'flag': '🇺🇸'},
    'telugu': {'name': 'Telugu (తెలుగు)', 'flag': '🇮🇳'}
}

def main():
    ui_styles.apply_custom_styles()
    
    # Hero Header
    ui_styles.render_hero("Knowledge Base Admin", "Manage offline textbooks and neural database")
    
    # Initialize backend
    if 'admin' not in st.session_state:
        with st.spinner("🚀 Initializing Neural Backend..."):
            st.session_state.admin = AITextbookAdminBackendOffline()
    
    admin = st.session_state.admin
    
    # Display system status with Premium Cards
    stats = admin.get_system_stats()
    
    st.markdown("### 📊 System Vital Signs")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        status = "Active" if admin.llm_available else "Offline"
        color = "#00ff88" if admin.llm_available else "#ff4444"
        ui_styles.render_glass_card(f"""
            <h3 style='margin:0'>Neural Core</h3>
            <div style='font-size: 2em; font-weight: bold; color: {color}'>{status}</div>
            <small>{admin.model_name if hasattr(admin, 'model_name') else 'N/A'}</small>
        """)
    
    with col2:
        ui_styles.render_glass_card(f"""
            <h3 style='margin:0'>Textbooks</h3>
            <div style='font-size: 2em; font-weight: bold; color: white'>{stats['total_textbooks']}</div>
            <small>Active Sources</small>
        """)
    
    with col3:
        ui_styles.render_glass_card(f"""
            <h3 style='margin:0'>Pages</h3>
            <div style='font-size: 2em; font-weight: bold; color: white'>{stats['total_pages']}</div>
            <small>Total Processed</small>
        """)
    
    with col4:
        db_status = "Ready" if stats['vectorstore_ready'] else "Empty"
        color = "#00ff88" if stats['vectorstore_ready'] else "#ffbb00"
        ui_styles.render_glass_card(f"""
            <h3 style='margin:0'>Vector DB</h3>
            <div style='font-size: 2em; font-weight: bold; color: {color}'>{db_status}</div>
            <small>ChromaDB Local</small>
        """)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Main tabs with better naming
    tab1, tab2, tab3 = st.tabs(["📤 Upload Center", "📚 Library Manager", "⚙️ System Control"])
    
    with tab1:
        st.markdown("<br>", unsafe_allow_html=True)
        show_upload_interface(admin)
    
    with tab2:
        st.markdown("<br>", unsafe_allow_html=True)
        show_manage_interface(admin)
    
    with tab3:
        st.markdown("<br>", unsafe_allow_html=True)
        show_settings_interface(admin)

def show_upload_interface(admin):
    """Upload interface for textbooks"""
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown("### 📤 Upload New Material")
        # File uploader
        uploaded_files = st.file_uploader(
            "Drop PDF textbooks here",
            type="pdf",
            accept_multiple_files=True,
            help="Maximum 200MB per file."
        )

    with col2:
        st.markdown("### ⚙️ Upload Settings")
        # Upload mode selection
        upload_mode = st.radio(
            "Processing Mode:",
            ["📝 Manual Configuration (Precise)", "🔍 Auto-Detection (Fast)"],
            help="Manual is recommended for mixed-language content"
        )
    
    if uploaded_files:
        st.info(f"✨ {len(uploaded_files)} file(s) staged for processing")
        
        if "Manual" in upload_mode:
            show_manual_upload(admin, uploaded_files)
        else:
            show_auto_upload(admin, uploaded_files)

def show_manual_upload(admin, uploaded_files):
    """Manual language selection upload"""
    st.markdown("#### 📝 Configure Sources")
    
    # Process each file
    files_config = []
    
    for i, uploaded_file in enumerate(uploaded_files):
        with st.expander(f"📖 {uploaded_file.name}", expanded=True):
            col1, col2 = st.columns([2, 1])
            
            with col1:
                subject_name = st.text_input(
                    "Subject Title",
                    value=uploaded_file.name.replace('.pdf', '').replace('_', ' ').title(),
                    key=f"subject_{i}",
                    label_visibility="collapsed",
                    placeholder="Enter Subject Name"
                )
            
            with col2:
                language = st.selectbox(
                    "Language",
                    options=list(LANGUAGE_OPTIONS.keys()),
                    format_func=lambda x: f"{LANGUAGE_OPTIONS[x]['flag']} {LANGUAGE_OPTIONS[x]['name']}",
                    key=f"language_{i}",
                    label_visibility="collapsed"
                )
            
            files_config.append({
                'file': uploaded_file,
                'subject': subject_name,
                'language': language
            })
    
    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("🚀 Ingest All Documents", type="primary", use_container_width=True):
        upload_all_textbooks(admin, files_config)

def show_auto_upload(admin, uploaded_files):
    """Automatic language detection upload"""
    st.markdown("#### 🔍 Ready to Auto-Process")
    
    if st.button("⚡ Detective & Ingest", type="primary", use_container_width=True):
        upload_with_auto_detection(admin, uploaded_files)

def upload_all_textbooks(admin, files_config):
    """Upload all configured textbooks"""
    progress_bar = st.progress(0)
    status_placeholder = st.empty()
    
    results = []
    
    for i, config in enumerate(files_config):
        progress = (i) / len(files_config)
        progress_bar.progress(progress)
        status_placeholder.info(f"⚙️ Processing: {config['subject']}...")
        
        success, message = admin.add_textbook(
            config['file'], 
            config['subject'], 
            config['language'],
            auto_detected=False
        )
        
        results.append({
            'Subject': str(config['subject']),
            'Status': 'Success' if success else 'Failed',
            'Message': str(message)
        })
        
        progress_bar.progress((i + 1) / len(files_config))
    
    status_placeholder.success("🎉 Ingestion Complete!")
    progress_bar.progress(1.0)
    
    # Results
    for res in results:
        if res['Status'] == 'Success':
            st.success(res['Subject'])
        else:
            st.error(f"{res['Subject']}: {res['Message']}")

def upload_with_auto_detection(admin, uploaded_files):
    """Upload with automatic language detection"""
    progress_bar = st.progress(0)
    status_placeholder = st.empty()
    
    for i, uploaded_file in enumerate(uploaded_files):
        progress_bar.progress(i / len(uploaded_files))
        status_placeholder.info(f"🔍 Analyzing: {uploaded_file.name}")
        
        detected_lang, _ = admin.detect_pdf_language(uploaded_file)
        if detected_lang == "unknown": detected_lang = "english"
        
        subject_name = uploaded_file.name.replace('.pdf', '').replace('_', ' ').title()
        
        admin.add_textbook(
            uploaded_file, 
            subject_name, 
            detected_lang,
            auto_detected=True
        )
        
    status_placeholder.success("🎉 Process Complete!")
    progress_bar.progress(1.0)

def show_manage_interface(admin):
    """Interface to manage existing textbooks"""
    
    if not admin.textbooks:
        st.info("Library is empty. Upload textbooks to see them here.")
        return
    
    # Display as cards
    cols_per_row = 3
    textbook_items = list(admin.textbooks.items())
    
    for i in range(0, len(textbook_items), cols_per_row):
        cols = st.columns(cols_per_row)
        for j, col in enumerate(cols):
            if i + j < len(textbook_items):
                subject, info = textbook_items[i + j]
                
                with col:
                    lang_info = LANGUAGE_OPTIONS.get(info['language'], {'name': info['language'].title(), 'flag': '📖'})
                    
                    # Custom Card HTML
                    ui_styles.render_glass_card(f"""
                        <h4>{lang_info['flag']} {subject}</h4>
                        <small>{lang_info['name']}</small><br>
                        <b>{info['pages']}</b> pages • <b>{info['chunks']}</b> chunks
                    """)
                    
                    if st.button("Delete", key=f"del_{subject}"):
                         admin.remove_textbook(subject)
                         st.rerun()

    # Bulk operations
    st.markdown("---")
    if st.button("⚠️ Format Library (Delete All)", type="secondary"):
        st.session_state["confirm_remove_all"] = True
    
    if st.session_state.get("confirm_remove_all", False):
        if st.button("🔥 Yes, DELETE EVERYTHING", type="primary"):
            for subject in list(admin.textbooks.keys()):
                admin.remove_textbook(subject)
            st.session_state["confirm_remove_all"] = False
            st.rerun()

def show_settings_interface(admin):
    """System settings and maintenance"""
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 🔍 Database Maintenance")
        ui_styles.render_glass_card(f"""
            Status: <b>{'Online' if admin.vectorstore else 'Offline'}</b><br>
            <small>ChromaDB Vector Store</small>
        """)
        
        if st.button("🔄 Re-index Database"):
            with st.spinner("Indexing..."):
                try:
                    admin.load_existing_data()
                    st.success("Done!")
                except Exception as e:
                    st.error(str(e))
    
    with col2:
        st.markdown("### 🗑️ Data Reset")
        st.warning("Danger Zone")
        
        if st.button("FACTORY RESET (Clear All Data)"):
            clear_all_data(admin)
            st.rerun()

def clear_all_data(admin):
    """Clear all data"""
    admin.textbooks = {}
    admin.save_metadata()
    st.success("Metadata wiped. Restart required for full effect.")

if __name__ == "__main__":
    main()
