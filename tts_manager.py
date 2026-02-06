import sys
import os
import tempfile
import subprocess
import uuid

class TTSManager:
    def __init__(self):
        print("✅ TTS Manager (Subprocess Mode) ready")

    def generate_audio(self, text, language='english', timeout=30):
        """Generate audio using an isolated subprocess to prevent engine crashes"""
        try:
            # Create a unique temp file path
            temp_dir = tempfile.gettempdir()
            filename = f"tts_{uuid.uuid4()}.wav"
            temp_path = os.path.join(temp_dir, filename)
            
            # Helper script path
            script_path = os.path.join(os.getcwd(), "tts_worker_script.py")
            
            # Run the isolated worker
            # We use sys.executable to ensure we use the same python environment
            cmd = [
                sys.executable, 
                script_path,
                "--text", text,
                "--file", temp_path,
                "--lang", language
            ]
            
            # Run with timeout
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=timeout,
                encoding='utf-8' # Force encoding
            )
            
            if result.returncode == 0 and "SUCCESS" in result.stdout:
                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    return temp_path
                else:
                    print("❌ TTS Worker succeeded but file is missing/empty")
                    return None
            else:
                print(f"❌ TTS Worker Failed: {result.stderr}")
                return None

        except subprocess.TimeoutExpired:
            print("❌ TTS Worker Timed Out")
            return None
        except Exception as e:
            print(f"❌ TTS Manager Error: {e}")
            return None
