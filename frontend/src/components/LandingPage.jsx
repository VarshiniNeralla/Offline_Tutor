import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  GraduationCap,
  Users,
  ShieldCheck,
  WifiOff,
  BookOpen,
  MessageSquare,
  FileText,
  Zap,
  Target,
  CheckCircle2,
  Upload,
  Cpu,
  Lock,
  Grid,
  CheckSquare,
  Layout,
  Scale,
  HelpCircle,
  ListChecks,
  MonitorPlay,
  Search
} from "lucide-react";

// Assets
import heroImage from "../assets/images/Girl with laptop.svg";

const LandingPage = () => {
  const navigate = useNavigate();

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="landing-root">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-container">
          <a href="/" className="nav-logo">
            <span className="logo-text">ShikshaAI</span>
            <span className="logo-tagline">Offline AI Study Companion</span>
          </a>

          <div className="nav-links">
            <a href="#roles" onClick={(e) => { e.preventDefault(); scrollTo('roles'); }}>Users</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How it Works</a>
            <a href="#offline" onClick={(e) => { e.preventDefault(); scrollTo('offline'); }}>Features</a>
            <a href="#tools" onClick={(e) => { e.preventDefault(); scrollTo('tools'); }}>Tools</a>
            <button className="nav-cta" onClick={() => navigate('/student/login')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-text">
            <h1>Your personal <br /><span className="gradient-text">AI study space</span></h1>
            <p>Where focused study meets intelligent practice.</p>
            <button className="btn-primary" onClick={() => navigate('/student/login')}>
              Start Learning Now <ArrowRight size={20} />
            </button>
          </div>
          <div className="hero-image">
            <img src={heroImage} alt="Study Illustration" />
          </div>
        </div>
      </section>

      {/* ROLES / DESIGNED FOR (Users) */}
      <section id="roles" className="section-padding">
        <div className="container">
          <div className="section-header">
            <h2>Designed for Growth</h2>
            <p>Clear responsibilities for teachers and powerful tools for students.</p>
          </div>

          <div className="role-split">
            <div className="role-v2-card student">
              <h3>For Students</h3>
              <ul className="role-features">
                <li><CheckCircle2 size={18} /> Chapter-wise learning</li>
                <li><CheckCircle2 size={18} /> Ask doubts freely and privately</li>
                <li><CheckCircle2 size={18} /> Practice with generated quizzes</li>
                <li><CheckCircle2 size={18} /> Learn at your own pace</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/student/login')}>Explore Student Space</button>
            </div>

            <div className="role-v2-card teacher">
              <h3>For Teachers</h3>
              <ul className="role-features">
                <li><CheckCircle2 size={18} /> Seamlessly upload textbooks</li>
                <li><CheckCircle2 size={18} /> Organize by class and subject</li>
                <li><CheckCircle2 size={18} /> No AI training or internet needed</li>
                <li><CheckCircle2 size={18} /> Perfect for school labs</li>
              </ul>
              <button className="btn-secondary" onClick={() => navigate('/teacher')}>Manage Digital Library</button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section-padding">
        <div className="container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>A simple 3-step flow to transform your textbooks into an interactive experience.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="offline-icon" style={{ margin: '0 auto 20px' }}><Upload size={24} /></div>
              <h3>Teacher Uploads</h3>
              <p>Teachers upload standard PDFs of textbooks to the secure local library.</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="offline-icon" style={{ margin: '0 auto 20px' }}><Cpu size={24} /></div>
              <h3>AI Understands</h3>
              <p>The system understands the content chapter-by-chapter without internet.</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="offline-icon" style={{ margin: '0 auto 20px' }}><BookOpen size={24} /></div>
              <h3>Student Studies</h3>
              <p>Students select a book and start chatting with their personal AI tutor.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OFFLINE FIRST SECTION (Features) */}
      <section id="offline" className="section-padding bg-light">
        <div className="container">
          <div className="section-header">
            <h2>Study without distractions</h2>
            <p>Built for environments where focus is the priority. No internet required, no data leaves your device.</p>
          </div>

          <div className="offline-grid">
            <div className="offline-card">
              <div className="offline-icon"><WifiOff size={28} /></div>
              <div className="offline-info">
                <h3>Works Fully Offline</h3>
                <p>The AI brain runs locally on your machine. You don't need a single byte of data to study.</p>
              </div>
            </div>
            <div className="offline-card">
              <div className="offline-icon"><ShieldCheck size={28} /></div>
              <div className="offline-info">
                <h3>Private & Secure</h3>
                <p>Your questions and textbook data stay on your computer. Private by design, safe for schools.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STUDY TOOLS PREVIEW (Tools) */}
      <section id="tools" className="section-padding">
        <div className="container">
          <div className="section-header">
            <h2>Comprehensive Study Tools</h2>
            <p>Everything you need to master your curriculum, powered by offline intelligence.</p>
          </div>

          <div className="tool-previews">
            <ToolCard icon={<MessageSquare size={24} />} title="AI Chat Tutor" benefit="Instant clarity on any topic from your textbook." />
            <ToolCard icon={<Users size={24} />} title="Mind Maps" benefit="Visualize connections between different concepts." />
            <ToolCard icon={<FileText size={24} />} title="Chapter Summaries" benefit="Quickly grasp core concepts of every lesson." />
            <ToolCard icon={<Zap size={24} />} title="Smart Quizzes" benefit="Test your knowledge with auto-generated questions." />
            {/* <ToolCard icon={<Grid size={24} />} title="Match the Following" benefit="Connect concepts with definitions interactively." /> */}
            <ToolCard icon={<CheckSquare size={24} />} title="True or False" benefit="Quick fact-checking from textbook content." />
            <ToolCard icon={<Layout size={24} />} title="One Page Revision" benefit="Condense entire chapters into single sheets." />
            <ToolCard icon={<Search size={24} />} title="Keyword Explorer" benefit="Instant definitions for complex terms." />
            {/* <ToolCard icon={<Scale size={24} />} title="Compare & Contrast" benefit="Side-by-side analysis of similar topics." /> */}
            {/* <ToolCard icon={<HelpCircle size={24} />} title="Doubt Detector" benefit="Identifying confusing areas automatically." /> */}
            {/* <ToolCard icon={<ListChecks size={24} />} title="What Did I Miss" benefit="Gap analysis for your written answers." /> */}
            <ToolCard icon={<GraduationCap size={24} />} title="Oral Tests" benefit="Prepare for exams with interactive AI questioning." />
          </div>
        </div>
      </section>

      {/* TRUST AND SAFETY (Commented Out) */}
      {/* <section className="section-padding">
        <div className="container">
          <div className="trust-banner">
            <h2>Built for education, not surveillance</h2>
            <div className="trust-points">
              <div className="trust-tag">
                <WifiOff size={32} />
                <span>Zero Internet</span>
              </div>
              <div className="trust-tag">
                <Lock size={32} />
                <span>Privacy First</span>
              </div>
              <div className="trust-tag">
                <ShieldCheck size={32} />
                <span>No Tracking</span>
              </div>
              <div className="trust-tag">
                <CheckCircle2 size={32} />
                <span>No Ads</span>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* FOOTER */}
      <footer className="footer-simple">
        <div className="container">
          <div className="footer-content-simple">
            <div className="footer-brand-simple">
              <h2>ShikshaAI</h2>
              <p>&copy; {new Date().getFullYear()} Private, offline AI study companion.</p>
            </div>
            <div className="footer-links-simple">
              <a href="/teacher" onClick={(e) => { e.preventDefault(); navigate('/teacher'); }}>Teacher Login</a>
              <span className="divider">|</span>
              <a href="#tools" onClick={(e) => { e.preventDefault(); scrollTo('tools'); }}>Tools</a>
              <span className="divider">|</span>
              <span>v1.0.0 (Local)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ToolCard = ({ icon, title, benefit }) => (
  <div className="tool-mini-card">
    <div className="offline-icon">{icon}</div>
    <h4>{title}</h4>
    <p>{benefit}</p>
  </div>
);

export default LandingPage;