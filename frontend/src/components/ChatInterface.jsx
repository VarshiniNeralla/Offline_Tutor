// import React, { useState, useEffect, useRef } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { Send, Mic, BookOpen, ChevronLeft, Trash2, Sparkles, AlertCircle } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';

// const ChatInterface = () => {
//     const location = useLocation();
//     const navigate = useNavigate();
//     const { subject, class: className, bookId, bookName } = location.state || {};

//     // Redirect if no context
//     useEffect(() => {
//         if (!subject) {
//             navigate('/student/dashboard');
//         }
//     }, [subject, navigate]);

//     const [messages, setMessages] = useState([
//         { role: 'assistant', content: `Hello! I'm your AI tutor for "${bookName || subject}". Ask me anything about this chapter!`, sources: [] }
//     ]);
//     const [input, setInput] = useState('');
//     const [isLoading, setIsLoading] = useState(false);
//     const [language, setLanguage] = useState('english');
//     const [isListening, setIsListening] = useState(false);

//     const messagesEndRef = useRef(null);
//     const scrollToBottom = () => {
//         messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//     };

//     useEffect(() => {
//         scrollToBottom();
//     }, [messages]);

//     const handleSend = async () => {
//         if (!input.trim() || isLoading) return;

//         const userMsg = { role: 'user', content: input };
//         setMessages(prev => [...prev, userMsg]);
//         setInput('');
//         setIsLoading(true);

//         try {
//             const response = await fetch('/api/chat', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     message: input,
//                     subjects: [subject],
//                     book_ids: bookId ? [bookId] : null,
//                     language: language
//                 })
//             });
//             const data = await response.json();
//             setMessages(prev => [...prev, { role: 'assistant', content: data.response, sources: data.sources }]);
//         } catch (error) {
//             setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble reading the textbook right now. Please try again.", sources: [] }]);
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     return (
//         <div className="flex flex-col h-screen bg-slate-50 relative">
//             {/* Header */}
//             <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
//                 <div className="wrapper py-3 flex items-center justify-between">
//                     <div className="flex items-center gap-4">
//                         <button
//                             onClick={() => navigate('/student/dashboard')}
//                             className="p-2 -ml-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
//                         >
//                             <ChevronLeft size={22} />
//                         </button>
//                         <div>
//                             <div className="flex items-center gap-2">
//                                 <h1 className="text-lg font-bold text-slate-900 m-0 leading-none">{bookName || subject}</h1>
//                                 <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
//                                     {className}
//                                 </span>
//                             </div>
//                             <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
//                                 <BookOpen size={12} className="text-indigo-500" />
//                                 {subject}
//                             </p>
//                         </div>
//                     </div>

//                     <div className="flex gap-2">
//                         <select
//                             className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400 transition-colors"
//                             value={language}
//                             onChange={(e) => setLanguage(e.target.value)}
//                         >
//                             <option value="english">🇺🇸 English</option>
//                             <option value="telugu">🇮🇳 Telugu</option>
//                         </select>

//                         <button
//                             onClick={() => setMessages([{ role: 'assistant', content: "Session reset. Ready for a new topic!", sources: [] }])}
//                             className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
//                             title="Clear Chat"
//                         >
//                             <Trash2 size={18} />
//                         </button>
//                     </div>
//                 </div>
//             </header>

//             {/* Chat Area */}
//             <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
//                 <div className="wrapper py-8 flex flex-col gap-6">
//                     <AnimatePresence initial={false}>
//                         {messages.map((msg, idx) => (
//                             <motion.div
//                                 key={idx}
//                                 initial={{ opacity: 0, y: 10 }}
//                                 animate={{ opacity: 1, y: 0 }}
//                                 className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
//                             >
//                                 <div className={`
//                                     max-w-[85%] md:max-w-[70%] lg:max-w-[60%] p-5 rounded-2xl shadow-sm
//                                     ${msg.role === 'user'
//                                         ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-100'
//                                         : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-slate-100'}
//                                 `}>
//                                     <div className="leading-relaxed whitespace-pre-wrap text-[15px]">
//                                         {msg.content}
//                                     </div>

//                                     {msg.sources && msg.sources.length > 0 && (
//                                         <div className={`mt-4 pt-3 border-t ${msg.role === 'user' ? 'border-white/20' : 'border-slate-100'}`}>
//                                             <div className="flex flex-wrap gap-2">
//                                                 {msg.sources.map((src, sidx) => (
//                                                     <span key={sidx} className={`
//                                                         flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-medium
//                                                         ${msg.role === 'user' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}
//                                                     `}>
//                                                         <BookOpen size={10} />
//                                                         {src}
//                                                     </span>
//                                                 ))}
//                                             </div>
//                                         </div>
//                                     )}
//                                 </div>
//                             </motion.div>
//                         ))}
//                         {isLoading && (
//                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
//                                 <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none flex items-center gap-3 shadow-sm">
//                                     <div className="flex gap-1.5">
//                                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></div>
//                                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
//                                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
//                                     </div>
//                                     <span className="text-xs text-slate-500 font-medium">Analyzing textbook...</span>
//                                 </div>
//                             </motion.div>
//                         )}
//                     </AnimatePresence>
//                     <div ref={messagesEndRef} />
//                 </div>
//             </div>

//             {/* Input Area */}
//             <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-30">
//                 <div className="wrapper flex items-center gap-3">
//                     <button
//                         className={`p-3 rounded-xl transition-all border ${isListening
//                             ? 'bg-red-50 text-red-500 border-red-100'
//                             : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-500'
//                             }`}
//                         onClick={() => setIsListening(!isListening)}
//                     >
//                         <Mic size={20} />
//                     </button>

//                     <div className="flex-1 relative">
//                         <input
//                             type="text"
//                             className="input-field"
//                             placeholder={`Ask a question about ${bookName || subject}...`}
//                             value={input}
//                             onChange={(e) => setInput(e.target.value)}
//                             onKeyPress={(e) => e.key === 'Enter' && handleSend()}
//                         />
//                     </div>

//                     <button
//                         onClick={handleSend}
//                         disabled={isLoading || !input.trim()}
//                         className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
//                     >
//                         <Send size={18} />
//                     </button>
//                 </div>
//             </div>

//             {/* Listening Modal */}
//             <AnimatePresence>
//                 {isListening && (
//                     <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50">
//                         <motion.div
//                             initial={{ opacity: 0, y: 10 }}
//                             animate={{ opacity: 1, y: 0 }}
//                             exit={{ opacity: 0, y: 10 }}
//                             className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4"
//                         >
//                             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
//                             <span className="text-sm font-medium">Listening...</span>
//                             <button onClick={() => setIsListening(false)} className="text-slate-500 hover:text-white ml-2">
//                                 &times;
//                             </button>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// };

// export default ChatInterface;


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

import "../assets/styles/chat-interface.css";

const ChatInterface = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    subject: navSubject,
    class: navClass,
    bookId: navBookId,
    bookName: navBookName
  } = location.state || {};

  // 1. CHAT HISTORY STATE
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("student_chats");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("english");
  const [listening, setListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const bottomRef = useRef(null);
  const hasInitialized = useRef(false);

  // 2. INITIALIZE SESSION
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (!navSubject || !navBookId) {
      if (chats.length === 0) {
        navigate("/student/dashboard");
      } else if (!activeChatId) {
        setActiveChatId(chats[0].id);
      }
      return;
    }

    // Check if we already have a chat for this specific book
    const existingBookChat = chats.find(c => c.bookId === navBookId);

    if (existingBookChat) {
      // Continue previous session
      setActiveChatId(existingBookChat.id);
    } else {
      // Start fresh
      startNewChat(navBookId, navBookName, navSubject, navClass, true);
    }
  }, [navBookId, navSubject, navigate, chats]);

  // Sync chats to localStorage
  useEffect(() => {
    localStorage.setItem("student_chats", JSON.stringify(chats));
  }, [chats]);

  const currentChat = chats.find(c => c.id === activeChatId) || null;
  const filteredChats = currentChat
    ? chats.filter(c => c.bookId === currentChat.bookId)
    : [];
  const messages = currentChat ? currentChat.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewChat = (bId, bName, sub, cls, isAuto = false) => {
    const targetBId = bId || navBookId || currentChat?.bookId;
    const targetBName = bName || navBookName || currentChat?.bookName;
    const targetSub = sub || navSubject || currentChat?.subject;
    const targetCls = cls || navClass || currentChat?.className;

    if (!targetBId) return;

    const newId = Date.now().toString();
    const newChat = {
      id: newId,
      title: "New Chat",
      bookId: targetBId,
      bookName: targetBName,
      subject: targetSub,
      className: targetCls,
      messages: [
        {
          role: "assistant",
          content: `You are studying "${targetBName}". Ask anything from this textbook.`,
          sources: []
        }
      ],
      timestamp: new Date().toISOString()
    };

    setChats(prev => {
      // If it's an auto-start, don't create a duplicate if one already exists
      if (isAuto && prev.find(c => c.bookId === targetBId)) return prev;
      return [newChat, ...prev];
    });
    setActiveChatId(newId);
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

    setChats(prev => prev.map(c =>
      c.id === activeChatId ? { ...c, messages: updatedMessages, title: newTitle } : c
    ));

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

      setChats(prev => prev.map(c =>
        c.id === activeChatId ? { ...c, messages: [...updatedMessages, assistantMessage] } : c
      ));

    } catch {
      const errorMessage = {
        role: "assistant",
        content: "I couldn't access the textbook right now.",
        sources: []
      };
      setChats(prev => prev.map(c =>
        c.id === activeChatId ? { ...c, messages: [...updatedMessages, errorMessage] } : c
      ));
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
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
      {/* SIDEBAR */}
      <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={() => startNewChat()}>
            <Sparkles size={16} /> New chat
          </button>
        </div>

        <div className="sidebar-content">
          <div className="history-group">
            <span className="group-label">Previous Chats</span>
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
                    <span className="item-meta">{chat.bookName}</span>
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
              <span className="user-status">Online</span>
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
              <h1>{currentChat?.title || "AI Tutor"}</h1>
              {currentChat && (
                <p>
                  <BookOpen size={12} /> {currentChat.bookName} • {currentChat.subject}
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
              <option value="telugu">Telugu</option>
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
                    {msg.sources.map((s, idx) => (
                      <span key={idx}>
                        <FileText size={10} /> {s}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div className="chat-bubble assistant">
                <div className="typing">
                  <span />
                  <span />
                  <span />
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
              onClick={() => setListening(!listening)}
            >
              <Mic size={20} />
            </button>

            <input
              placeholder={currentChat ? `Ask about ${currentChat.bookName}...` : "Select a chat to begin..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!activeChatId}
            />

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
