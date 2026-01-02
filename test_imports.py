print("Testing imports...")
try:
    import os
    import json
    import warnings
    import uuid
    import shutil
    print("Standard libraries OK")
    
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from langchain_community.vectorstores import Chroma
    print("Langchain libraries OK")
    
    import requests
    print("Requests OK")
    
    import torch
    print("Torch OK")
    
    try:
        from faster_whisper import WhisperModel
        print("faster-whisper OK")
    except ImportError:
        print("faster-whisper MISSING (optional)")
        
    try:
        import pyttsx3
        print("pyttsx3 OK")
    except ImportError:
        print("pyttsx3 MISSING (optional)")
        
    try:
        from langdetect import detect
        print("langdetect OK")
    except ImportError:
        print("langdetect MISSING (optional)")
        
    from fastapi import FastAPI
    print("FastAPI OK")
    
    import uvicorn
    print("Uvicorn OK")
    
    print("All critical imports tested.")
except ImportError as e:
    print(f"CRITICAL IMPORT FAILED: {e}")
except Exception as e:
    print(f"ERROR: {e}")
