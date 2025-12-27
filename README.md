# 🤖 Offline AI Tutor & Digital Library

A powerful, completely offline educational platform that provides students with an intelligent AI tutor, digital textbook library, and interactive study tools. Built for reliability in offline environments, it works without any internet connection.

---

## 🌟 Key Features

- **Brainy Offline AI**: Powered by local models (Ollama), providing intelligent answers even without internet.
- **Multilingual Support**: Learn in **English** or **Telugu** with native-language tutoring.
- **Independent Chapter Chats**: Each textbook chapter has its own private chat history, so students don't get confused between different topics.
- **Smart Learning Modes**:
  - ⚡ **Brief**: Quick 1-minute answers for fast facts.
  - 📖 **Standard**: Balanced explanations for daily studying.
  - 💎 **Premium**: Detailed deep-dives with examples and case studies.
- **Text-to-Speech & Voice**: Listens to your questions and speaks the answers back to you.
- **Admin Dashboard**: Easy-to-use interface to upload PDFs and build your library.
- **Clean, No-Cutter UI**: A premium, minimal interface designed for focus and readability.

---

## 🛠 Prerequisites

Before running the project, ensure you have the following installed:

1.  **Python 3.10+**: For the neural backend.
2.  **Node.js**: For the front-end interface.
3.  **Ollama**: Download from [ollama.com](https://ollama.com).
    - After installing, run `ollama pull phi3` to get the tutor's brain.

---

## 🚀 How to Run

### 1. Setup the Backend
Open a terminal and run:
```bash
# Navigate to project folder
cd AI-tutor-Community-Digital-Library

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
python api.py
```

### 2. Setup the Frontend
Open a **second** terminal and run:
```bash
# Navigate to frontend folder
cd frontend

# Install packages
npm install

# Start the UI
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 📖 Basic Usage

1.  **Admin**: Go to the Admin tab to upload your textbooks (PDFs). Once uploaded, they are indexed for the AI.
2.  **Study**: In the Student Dashboard, select your subject and textbook.
3.  **Chat**: Ask the AI questions about your textbook. Use keywords like "briefly" or "in detail" to control how long the AI speaks.
4.  **Listen**: Click the speaker icon to hear the AI read the explanation aloud!

---

## 🛡️ Note on Performance
Because this app runs entirely on your computer (no cloud), the AI speed depends on your CPU power. We have optimized the settings so that it stays patient even on slower machines!
