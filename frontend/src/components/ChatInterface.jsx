import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Send,
  Mic,
  BookOpen,
  ChevronLeft,
  Trash2,
  FileText,
  Languages,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "../context/LanguageContext";

import { translations } from "../translations";
import "../assets/styles/chat-interface.css";

const ChatInterface = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    subject: navSubject,
    class: navClass,
    bookId: navBookId,
    bookName: rawNavBookName,
    initTool
  } = location.state || {};

  const navBookName = rawNavBookName ? rawNavBookName.replace(/\.pdf$/i, '') : '';

  // 1. CHAT HISTORY STATE
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("student_chats");
    return saved ? JSON.parse(saved) : [];
  });
  // If we have cached chats, we consider them 'loaded' enough to render, but we still fetch to sync
  const [chatsLoaded, setChatsLoaded] = useState(true);

  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { language, setLanguage } = useLanguage();
  const t = translations[language];
  const [listening, setListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const bottomRef = useRef(null);
  const hasInitialized = useRef(false);
  const recognitionRef = useRef(null);
  const textBeforeRecording = useRef("");

  // Load from Backend on Mount & Sync
  useEffect(() => {
    fetch('/api/chats')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChats(data);
          // Update local storage to keep it fresh for next reload
          localStorage.setItem("student_chats", JSON.stringify(data));
        }
      })
      .catch(err => console.error("Failed to load chats:", err));
    // We don't strictly need to toggle chatsLoaded here anymore since we start true, 
    // but we could use another flag 'isSynced' if needed. For now, this is fine.
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let fullSessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullSessionTranscript += event.results[i][0].transcript;
        }
        const spacer = (textBeforeRecording.current && !textBeforeRecording.current.endsWith(' ')) ? ' ' : '';
        setInput(textBeforeRecording.current + spacer + fullSessionTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'no-speech') return;
        if (event.error === 'network') {
          alert(t.chat.networkError);
        }
        setListening(false);
      };

      recognitionRef.current.onend = () => {
        if (listening) setListening(false);
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (!navigator.onLine) {
      alert(t.chat.networkError);
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      textBeforeRecording.current = input;
      recognitionRef.current.lang = language === 'telugu' ? 'te-IN' : 'en-US';
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  };

  // 3. PERSIST ACTIVE ID IN HISTORY
  // This ensures that if we navigate away (e.g. to PDF) and come back, we know exactly which chat was active
  useEffect(() => {
    if (activeChatId) {
      // Only update if it's different to avoid loops
      if (location.state?.currentChatId !== activeChatId) {
        navigate('.', {
          state: { ...location.state, currentChatId: activeChatId },
          replace: true
        });
      }
    }
  }, [activeChatId, navigate, location.state]);

  // 2. INITIALIZE SESSION
  useEffect(() => {
    if (!chatsLoaded) return; // Wait for history load
    if (hasInitialized.current) return;

    // Check if we have arguments to auto-open a specific context
    if (!navSubject || !navBookId) {
      if (chats.length > 0 && !activeChatId) {
        setActiveChatId(chats[0].id);
      }
      hasInitialized.current = true;
      return;
    }

    hasInitialized.current = true;

    // PRIORITY 1: Restore exact previous session if known
    if (location.state?.currentChatId) {
      const target = chats.find(c => c.id === location.state.currentChatId);
      if (target) {
        setActiveChatId(target.id);
        return;
      }
    }

    // PRIORITY 2: Handle explicit Tool init (only if we didn't just restore a specific chat)
    if (initTool) {
      startNewChat(navBookId, navBookName, navSubject, navClass, true, initTool);
      // Consume the initTool so it doesn't fire again on reload/back
      const newState = { ...location.state };
      delete newState.initTool;
      navigate('.', { state: newState, replace: true });
      return;
    }

    // PRIORITY 3: Resume latest for this book
    const existingBookChat = chats.find(c => c.bookId === navBookId);

    if (existingBookChat) {
      // Continue previous session
      setActiveChatId(existingBookChat.id);
    } else {
      // Start fresh
      startNewChat(navBookId, navBookName, navSubject, navClass, true);
    }
  }, [chatsLoaded, navBookId, navSubject, navigate, chats, initTool, location.state]);

  // Sync helper
  const saveChatToBackend = async (chat) => {
    try {
      await fetch('/api/chats/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chat)
      });
    } catch (err) {
      console.error("Failed to save chat:", err);
    }
  };

  const currentChat = chats.find(c => c.id === activeChatId) || null;
  const filteredChats = currentChat
    ? chats.filter(c => c.bookId === currentChat.bookId)
    : [];
  const messages = currentChat ? currentChat.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewChat = (bId, bName, sub, cls, isAuto = false, toolType = null) => {
    const targetBId = bId || navBookId || currentChat?.bookId;
    const rawTargetBName = bName || navBookName || currentChat?.bookName;
    const targetBName = rawTargetBName ? rawTargetBName.replace(/\.pdf$/i, '') : '';
    const targetSub = sub || navSubject || currentChat?.subject;
    const targetCls = cls || navClass || currentChat?.className;

    if (!targetBId) return;

    // Custom Greeting based on Tool
    let initialMsg = t.chat.studyMessage.replace('{book}', targetBName);
    let title = t.chat.newChat;

    if (toolType) {
      title = `${toolType.charAt(0).toUpperCase() + toolType.slice(1)} Mode`;
      switch (toolType) {
        case 'quiz':
          initialMsg = t.chat.quizMsg.replace('{book}', targetBName);
          break;
        case 'flashcards':
          initialMsg = t.chat.flashMsg.replace('{book}', targetBName);
          break;
        case 'summary':
          initialMsg = t.chat.summaryMsg.replace('{book}', targetBName);
          break;
        case 'mindmap':
          initialMsg = t.chat.mindmapMsg.replace('{book}', targetBName);
          break;
        case 'oral':
          initialMsg = t.chat.oralMsg.replace('{book}', targetBName);
          break;
        case 'tfMsg':
          initialMsg = t.chat.tfMsg.replace('{book}', targetBName);
          break;
        case 'revision':
          initialMsg = t.chat.revisionMsg.replace('{book}', targetBName);
          break;
        case 'keywords':
          initialMsg = t.chat.keywordsMsg.replace('{book}', targetBName);
          break;
        default:
          initialMsg = t.chat.defaultToolMsg.replace('{book}', targetBName).replace('{tool}', toolType);
      }
    }

    const newId = Date.now().toString();
    const newChat = {
      id: newId,
      title: title,
      bookId: targetBId,
      bookName: targetBName,
      subject: targetSub,
      className: targetCls,
      messages: [
        {
          role: "assistant",
          content: initialMsg,
          sources: []
        }
      ],
      timestamp: new Date().toISOString()
    };

    setChats(prev => {
      // If it's an auto-start, only skip if we are NOT in tool mode (tool mode always forces new)
      if (isAuto && !toolType && prev.find(c => c.bookId === targetBId)) return prev;
      return [newChat, ...prev];
    });

    // Sync to backend if we created it
    if (!isAuto || toolType || !chats.find(c => c.bookId === targetBId)) {
      saveChatToBackend(newChat);
      setActiveChatId(newId);
    } else {
      // If we reused an existing one, set its ID
      const existing = chats.find(c => c.bookId === targetBId);
      if (existing) setActiveChatId(existing.id);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;

    const userContent = input.trim();
    const userMessage = { role: "user", content: userContent };

    // Update local messages immediately
    const updatedMessages = [...messages, userMessage];

    // Auto-update title if it's the first user message
    const isFirstUserMsg = messages.filter(m => m.role === 'user').length === 0;
    let newTitle = currentChat.title;
    if (isFirstUserMsg) {
      newTitle = userContent.length > 30 ? userContent.substring(0, 27) + "..." : userContent;
    }

    // Optimistic update
    const optimisticChat = { ...currentChat, messages: updatedMessages, title: newTitle };
    setChats(prev => prev.map(c => c.id === activeChatId ? optimisticChat : c));
    saveChatToBackend(optimisticChat);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          subjects: [currentChat.subject],
          book_ids: [currentChat.bookId],
          language
        })
      });

      const data = await res.json();
      const assistantMessage = {
        role: "assistant",
        content: data.response,
        sources: data.sources || []
      };

      const finalChat = {
        ...optimisticChat,
        messages: [...updatedMessages, assistantMessage]
      };

      setChats(prev => prev.map(c => c.id === activeChatId ? finalChat : c));
      saveChatToBackend(finalChat);

    } catch {
      const errorMessage = {
        role: "assistant",
        content: t.chat.error,
        sources: []
      };

      const errorChat = {
        ...optimisticChat,
        messages: [...updatedMessages, errorMessage]
      };

      setChats(prev => prev.map(c => c.id === activeChatId ? errorChat : c));
      saveChatToBackend(errorChat);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();

    // Delete from backend
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }

    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);

    // If we deleted the active chat, pick the next most recent one for THIS book
    if (activeChatId === id) {
      const remainingForBook = newChats.filter(c => c.bookId === currentChat?.bookId);
      if (remainingForBook.length > 0) {
        setActiveChatId(remainingForBook[0].id);
      } else {
        // If no chats left for this book, return to dashboard or start a new one
        setActiveChatId(null);
        hasInitialized.current = false; // Allow recovery effect to trigger
      }
    }
  };

  return (
    <div className="chat-layout">
      <style>{`
            .waveform-box {
                display: flex;
                align-items: center;
                gap: 3px;
                padding: 0 10px;
                height: 24px;
            }
            .wave-bar {
                width: 3px;
                background-color: #6366f1;
                border-radius: 2px;
                animation: wave-anim 1s ease-in-out infinite;
            }
            .wave-bar:nth-child(1) { animation-delay: 0.0s; height: 40%; }
            .wave-bar:nth-child(2) { animation-delay: 0.1s; height: 80%; }
            .wave-bar:nth-child(3) { animation-delay: 0.2s; height: 50%; }
            .wave-bar:nth-child(4) { animation-delay: 0.3s; height: 90%; }
            .wave-bar:nth-child(5) { animation-delay: 0.4s; height: 60%; }
            @keyframes wave-anim {
                0%, 100% { height: 30%; }
                50% { height: 100%; }
            }
        `}</style>
      {/* SIDEBAR */}
      <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={() => startNewChat()}>
            <Sparkles size={16} /> {t.chat.newChat}
          </button>
        </div>

        <div className="sidebar-content">
          <div className="history-group">
            <span className="group-label">{t.chat.previousChats}</span>
            <div className="history-list">
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  className={`history-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <FileText size={14} className="item-icon" />
                  <div className="item-info">
                    <span className="item-title">{chat.title}</span>
                    <span className="item-meta">{chat.bookName?.replace(/\.pdf$/i, '')}</span>
                  </div>
                  <button className="delete-btn" onClick={(e) => deleteChat(e, chat.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {localStorage.getItem("studentName")?.charAt(0) || "S"}
            </div>
            <div className="user-info">
              <span className="user-name">{localStorage.getItem("studentName") || "Student"}</span>
              <span className="user-status">{t.chat.online}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="chat-main">
        {/* HEADER */}
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="icon-btn" onClick={() => navigate("/student/dashboard")}>
              <ChevronLeft size={20} />
            </button>

            <div className="chat-context">
              <h1>{currentChat?.title || t.chat.title}</h1>
              {currentChat && (
                <p>
                  <BookOpen size={12} /> {currentChat.bookName?.replace(/\.pdf$/i, '')} • {currentChat.subject}
                </p>
              )}
            </div>
          </div>

          <div className="chat-header-right">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="english">English</option>
              <option value="telugu">తెలుగు</option>
            </select>
          </div>
        </header>

        {/* CHAT */}
        <main className="chat-body">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`chat-bubble ${msg.role}`}
              >
                <div className="chat-text">
                  {msg.role === "assistant" ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>

                {msg.sources?.length > 0 && (
                  <div className="chat-sources">
                    {msg.sources.map((s, idx) => {
                      // Parse source string to extract page number
                      // Expected format: "Subject - Page 10" or "Subject - పేజీ 10"
                      const pageMatch = s.match(/(?:Page|పేజీ)\s+(\d+)/i);
                      const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;

                      const handleSourceClick = () => {
                        if (currentChat?.bookId) {
                          navigate('/pdf-viewer', {
                            state: {
                              bookId: currentChat.bookId,
                              bookName: currentChat.bookName,
                              initialPage: pageNumber
                            }
                          });
                        }
                      };

                      return (
                        <button
                          key={idx}
                          onClick={handleSourceClick}
                          className="source-citation-btn"
                          title={`Click to open ${s}`}
                        >
                          <FileText size={10} /> {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div className="chat-bubble assistant">
                <div className="chat-text">
                  <div className="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="typing-text">{t.chat.analyzing}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </main>

        {/* INPUT */}
        <footer className="chat-input">
          <div className="input-wrapper">
            <button
              className={`icon-btn ${listening ? "listening" : ""}`}
              onClick={toggleListening}
            >
              <Mic size={20} />
            </button>

            <input
              placeholder={currentChat ? t.chat.placeholder : t.dashboard.selectSubject}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!activeChatId}
            />

            {listening && (
              <div className="waveform-box">
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
              </div>
            )}

            <button
              className="send-btn"
              disabled={!input.trim() || loading || !activeChatId}
              onClick={sendMessage}
            >
              <Send size={18} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatInterface;
