import sys
import pyttsx3
import argparse

def generate_speech(text, output_file, language='english'):
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.setProperty('volume', 0.9)
        
        # Voice Selection
        voices = engine.getProperty('voices')
        selected_voice = None
        if voices:
            for voice in voices:
                if language == 'telugu' and ('telugu' in voice.name.lower() or 'te' in voice.id.lower()):
                    selected_voice = voice.id
                    break
                elif language == 'english' and ('english' in voice.name.lower() or 'en' in voice.id.lower()):
                    if 'us' in voice.id.lower() or 'united states' in voice.name.lower():
                        selected_voice = voice.id
                        break
                    selected_voice = voice.id
        
        if selected_voice:
            engine.setProperty('voice', selected_voice)
        elif voices:
            engine.setProperty('voice', voices[0].id)
            
        engine.save_to_file(text, output_file)
        engine.runAndWait()
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--lang", default="english")
    args = parser.parse_args()
    
    generate_speech(args.text, args.file, args.lang)
