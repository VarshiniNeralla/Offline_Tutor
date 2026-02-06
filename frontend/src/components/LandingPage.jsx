import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { translations } from "../translations";
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
  Search,
  Menu,
  X,
  Languages
} from "lucide-react";

// Assets
import heroImage from "../assets/images/Girl with laptop.svg";

const LandingPage = () => {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language] || translations['english'];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setMobileMenuOpen(false); // Close menu on click
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

          {/* Desktop Links */}
          <div className="nav-links">
            <a href="#roles" onClick={(e) => { e.preventDefault(); scrollTo('roles'); }}>{t.nav.users}</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>{t.nav.howItWorks}</a>
            <a href="#offline" onClick={(e) => { e.preventDefault(); scrollTo('offline'); }}>{t.nav.features}</a>
            <a href="#tools" onClick={(e) => { e.preventDefault(); scrollTo('tools'); }}>{t.nav.tools}</a>

            <button className="lang-toggle-btn" onClick={toggleLanguage} title={language === 'english' ? 'Telugu లోకి మారండి' : 'Switch to English'}>
              <Languages size={18} />
              <span>{language === 'english' ? 'తెలుగు' : 'English'}</span>
            </button>

            <button className="nav-cta" onClick={() => navigate('/student/login')}>{t.nav.getStarted}</button>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-nav-links">
            <a href="#roles" onClick={(e) => { e.preventDefault(); scrollTo('roles'); }}>{t.nav.users}</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>{t.nav.howItWorks}</a>
            <a href="#offline" onClick={(e) => { e.preventDefault(); scrollTo('offline'); }}>{t.nav.features}</a>
            <a href="#tools" onClick={(e) => { e.preventDefault(); scrollTo('tools'); }}>{t.nav.tools}</a>

            <button className="lang-toggle-btn-mobile" onClick={toggleLanguage}>
              <Languages size={20} />
              <span>{language === 'english' ? 'తెలుగు' : 'English'}</span>
            </button>

            <button className="nav-cta mobile-cta" onClick={() => navigate('/student/login')}>{t.nav.getStarted}</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-text">
            <h1>{t.hero.title}</h1>
            <p>{t.hero.subtitle}</p>
            <button className="btn-primary" onClick={() => navigate('/student/login')}>
              {t.hero.cta} <ArrowRight size={20} />
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
            <h2>{t.roles.title}</h2>
            <p>{t.roles.subtitle}</p>
          </div>

          <div className="role-split">
            <div className="role-v2-card student">
              <h3>{t.roles.forStudents}</h3>
              <ul className="role-features">
                {t.roles.studentsFeatures.map((f, i) => (
                  <li key={i}><CheckCircle2 size={18} /> {f}</li>
                ))}
              </ul>
              <button className="btn-primary" onClick={() => navigate('/student/login')}>{t.roles.exploreStudents}</button>
            </div>

            <div className="role-v2-card teacher">
              <h3>{t.roles.forTeachers}</h3>
              <ul className="role-features">
                {t.roles.teachersFeatures.map((f, i) => (
                  <li key={i}><CheckCircle2 size={18} /> {f}</li>
                ))}
              </ul>
              <button className="btn-secondary" onClick={() => navigate('/teacher')}>{t.roles.manageLibrary}</button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section-padding">
        <div className="container">
          <div className="section-header">
            <h2>{t.howItWorks.title}</h2>
            <p>{t.howItWorks.subtitle}</p>
          </div>

          <div className="steps-grid">
            {t.howItWorks.steps.map((s, i) => (
              <div className="step-card" key={i}>
                <div className="step-num">{i + 1}</div>
                <div className="offline-icon" style={{ margin: '0 auto 20px' }}>
                  {i === 0 ? <Upload size={24} /> : i === 1 ? <Cpu size={24} /> : <BookOpen size={24} />}
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OFFLINE FIRST SECTION (Features) */}
      <section id="offline" className="section-padding bg-light">
        <div className="container">
          <div className="section-header">
            <h2>{t.features.title}</h2>
            <p>{t.features.subtitle}</p>
          </div>

          <div className="offline-grid">
            <div className="offline-card">
              <div className="offline-icon"><WifiOff size={28} /></div>
              <div className="offline-info">
                <h3>{t.features.offline.title}</h3>
                <p>{t.features.offline.desc}</p>
              </div>
            </div>
            <div className="offline-card">
              <div className="offline-icon"><ShieldCheck size={28} /></div>
              <div className="offline-info">
                <h3>{t.features.private.title}</h3>
                <p>{t.features.private.desc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STUDY TOOLS PREVIEW (Tools) */}
      <section id="tools" className="section-padding">
        <div className="container">
          <div className="section-header">
            <h2>{t.tools.title}</h2>
            <p>{t.tools.subtitle}</p>
          </div>

          <div className="tool-previews">
            <ToolCard icon={<MessageSquare size={24} />} title={t.tools.items.chat} benefit="Instant clarity on any topic from your textbook." />
            <ToolCard icon={<FileText size={24} />} title={t.tools.items.summary} benefit="Quickly grasp core concepts of every lesson." />
            <ToolCard icon={<Zap size={24} />} title={t.tools.items.quiz} benefit="Test your knowledge with auto-generated questions." />
            <ToolCard icon={<Users size={24} />} title={t.tools.items.mindmap} benefit="Visualize connections between different concepts." />
            <ToolCard icon={<CheckSquare size={24} />} title={t.tools.items.truefalse} benefit="Quick fact-checking from textbook content." />
            <ToolCard icon={<Layout size={24} />} title={t.tools.items.revision} benefit="Condense entire chapters into single sheets." />
            <ToolCard icon={<Search size={24} />} title={t.tools.items.keywords} benefit="Instant definitions for complex terms." />
            <ToolCard icon={<GraduationCap size={24} />} title={t.tools.items.oral_test} benefit="Prepare for exams with interactive AI questioning." />
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
              <p>&copy; {new Date().getFullYear()} {t.footer.brand}</p>
            </div>
            <div className="footer-links-simple">
              <a href="/teacher" onClick={(e) => { e.preventDefault(); navigate('/teacher'); }}>{t.footer.teacherLogin}</a>
              <span className="divider">|</span>
              <a href="#tools" onClick={(e) => { e.preventDefault(); scrollTo('tools'); }}>{t.nav.tools}</a>
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