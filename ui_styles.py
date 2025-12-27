import streamlit as st
import base64

def apply_custom_styles():
    """Apply premium glassmorphic styles and custom logic to the Streamlit app"""
    
    # 1. Hide default Streamlit elements that look 'robotic'
    hide_streamlit_style = """
        <style>
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
        .stDeployButton {display:none;}
        </style>
    """
    st.markdown(hide_streamlit_style, unsafe_allow_html=True)
    
    # 2. Main Custom CSS
    custom_css = """
        <style>
        /* IMPORT FONTS */
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        /* GLOBAL VARIABLES */
        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --secondary-gradient: linear-gradient(135deg, #FF6B6B 0%, #556270 100%);
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-primary: #ffffff;
            --text-secondary: #e0e0e0;
            --card-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }

        /* BODY & BACKGROUND */
        .stApp {
            background: #0f0c29;  /* fallback for old browsers */
            background: -webkit-linear-gradient(to right, #24243e, #302b63, #0f0c29);
            background: linear-gradient(to right, #24243e, #302b63, #0f0c29);
            font-family: 'Outfit', sans-serif;
            color: var(--text-primary);
        }

        /* TYPOGRAPHY */
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600;
            color: white !important;
            letter-spacing: 0.5px;
        }
        
        p, div, label, span {
            font-family: 'Outfit', sans-serif;
            color: var(--text-secondary);
        }

        /* SIDEBAR styling */
        section[data-testid="stSidebar"] {
            background-color: rgba(15, 12, 41, 0.6);
            backdrop-filter: blur(15px);
            border-right: 1px solid var(--glass-border);
        }
        
        /* CARDS / CONTAINERS */
        .stExpander, .stChatInput, .stTextInput > div > div {
            background: var(--glass-bg) !important;
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border) !important;
            border-radius: 15px !important;
            box-shadow: var(--card-shadow); 
        }

        /* BUTTONS */
        .stButton > button {
            background: var(--primary-gradient) !important;
            color: white !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 0.6rem 1.2rem !important;
            font-weight: 500 !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
        }
        
        .stButton > button:hover {
            transform: translateY(-2px);
            box-shadow: 0 7px 14px rgba(0,0,0,0.2);
            filter: brightness(110%);
        }
        
        /* Secondary buttons (use outline or different styling if needed, but for now uniform) */
        
        /* CHAT BUBBLES */
        .stChatMessage {
            background-color: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            border-radius: 15px;
            padding: 15px;
            margin-bottom: 10px;
        }
        
        /* USER message specific (Streamlit doesn't expose easy class for this, but generic is better than nothing) */
        /* AVATARS */
        .stChatMessage .stChatMessageAvatar {
            background: var(--primary-gradient);
            border-radius: 50%;
        }

        /* INPUT FIELDS */
        .stTextInput input {
            color: white !important;
            background: transparent !important;
        }

        /* METRICS / STATS */
        [data-testid="stMetricValue"] {
            font-size: 2.5rem !important;
            background: -webkit-linear-gradient(#eee, #333);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 700;
        }
        
        /* PROGRESS BARS */
        .stProgress > div > div > div > div {
            background: var(--primary-gradient);
        }

        /* CUSTOM CLASSES FOR SPECIAL ELEMENTS */
        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: var(--card-shadow);
        }
        
        .hero-title {
            font-size: 3.5rem;
            font-weight: 700;
            background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            margin-bottom: 1px;
        }
        
        .hero-subtitle {
            text-align: center;
            font-size: 1.2rem;
            opacity: 0.8;
            margin-bottom: 30px;
        }
        
        /* REMOVE WHITE BACKGROUNDS FROM PLOTS/IMAGES IF ANY */
        
        /* SCROLLBAR */
        ::-webkit-scrollbar {
            width: 10px;
            background: #1a1a2e;
        }
        ::-webkit-scrollbar-thumb {
            background: #4a4e69; 
            border-radius: 10px;
        }
        </style>
    """
    st.markdown(custom_css, unsafe_allow_html=True)

def render_glass_card(content):
    """Ref Helper to render a glass card container"""
    st.markdown(f"""
    <div class="glass-card">
        {content}
    </div>
    """, unsafe_allow_html=True)

def render_hero(title, subtitle):
    """Render a beautiful hero section"""
    st.markdown(f"""
    <div style="padding: 40px 0;">
        <h1 class="hero-title">{title}</h1>
        <p class="hero-subtitle">{subtitle}</p>
    </div>
    """, unsafe_allow_html=True)
