import os
import subprocess
import sys
import time
import webbrowser

def install_dependencies():
    print("📦 Checking dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def run_server():
    print("🚀 Starting AI Tutor Backend...")
    # Use uvicorn directly via subprocess to see output 
    # In production/deployment, we might want to hide console or manage it better
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api:app", "--host", "localhost", "--port", "8000"],
        cwd=os.getcwd()
    )
    return server_process

def main():
    print("="*50)
    print("   AI TEXTBOOK TUTOR - OFFLINE NEURAL SERVER   ")
    print("="*50)
    
    # 1. Install deps (fast check)
    try:
        import fastapi
    except ImportError:
        install_dependencies()
        
    # 2. Start Backend
    server_process = run_server()
     
    # 3. Open Browser (wait a bit for server to start)
    print("⏳ Waiting for server to initialize...")
    time.sleep(5)
    
    url = "http://localhost:8000"
    print(f"🌐 Opening interface at {url}")
    webbrowser.open(url)
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        server_process.terminate()

if __name__ == "__main__":
    main()
