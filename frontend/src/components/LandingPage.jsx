// import React from "react";
// import { useNavigate } from "react-router-dom";
// import { ArrowRight, GraduationCap, Users } from "lucide-react";

// // Assets
// import heroImage from "../assets/images/Girl with laptop.svg";

// import iconTextbooks from "../assets/images/undraw_road-to-knowledge_f9zn.svg";
// import iconAnswers from "../assets/images/undraw_artificial-intelligence_43qa.svg";
// import iconSummaries from "../assets/images/undraw_taking-notes_oyqz.svg";
// import iconQuizzes from "../assets/images/undraw_online-learning_tgmv.svg";
// import iconPractice from "../assets/images/undraw_deep-work_muov.svg";
// import iconMindMaps from "../assets/images/undraw_adventure-map_3e4p.svg";

// const LandingPage = () => {
//   const navigate = useNavigate();

//   return (
//     <div className="landing-root">
//       <div className="container">

//         {/* HERO */}
//         <section className="hero">
//           <div className="hero-text">
//             <span className="badge">Offline Study Companion</span>

//             <h1>
//               Your personal <br />
//               <span className="gradient-text">AI study space</span>
//             </h1>

//             <p>
//               Study calmly. Ask questions. Practice deeply.
//               Everything works offline.
//             </p>
//           </div>

//           <div className="hero-image">
//             <img src={heroImage} alt="Study Illustration" />
//           </div>
//         </section>

//         {/* ROLE SELECTION */}
//         <section className="roles">
//           <h2>Choose your role</h2>

//           <div className="role-grid">
//             <div
//               className="role-card"
//               onClick={() => navigate("/student/login")}
//             >
//               <div className="role-icon">
//                 <GraduationCap size={28} />
//               </div>

//               <h3>Student</h3>
//               <p>Learn, revise, and practice</p>

//               <button className="btn-primary">
//                 Enter Study Space <ArrowRight size={16} />
//               </button>
//             </div>

//             <div
//               className="role-card"
//               onClick={() => navigate("/teacher")}
//             >
//               <div className="role-icon muted">
//                 <Users size={28} />
//               </div>

//               <h3>Teacher</h3>
//               <p>Manage textbooks and classes</p>

//               <button className="btn-secondary">
//                 Manage Library <ArrowRight size={16} />
//               </button>
//             </div>
//           </div>
//         </section>

//         {/* FEATURES */}
//         <section className="features">
//           <h2>What you can do</h2>

//           <div className="feature-grid">
//             <FeatureCard icon={iconTextbooks} title="Digital Textbooks" desc="Read and search instantly" />
//             <FeatureCard icon={iconAnswers} title="Instant Answers" desc="Ask and understand" />
//             <FeatureCard icon={iconSummaries} title="Chapter Summaries" desc="Revise faster" />
//             <FeatureCard icon={iconQuizzes} title="Auto Quizzes" desc="Test yourself" />
//             <FeatureCard icon={iconPractice} title="Practice Mode" desc="Learn by doing" />
//             <FeatureCard icon={iconMindMaps} title="Mind Maps" desc="See the big picture" />
//           </div>
//         </section>

//       </div>
//     </div>
//   );
// };

// const FeatureCard = ({ icon, title, desc }) => (
//   <div className="feature-card">
//     <div className="feature-icon">
//       <img src={icon} alt={title} />
//     </div>

//     <h3>{title}</h3>
//     <p>{desc}</p>
//   </div>
// );

// export default LandingPage;

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, Users } from "lucide-react";

// Assets
import heroImage from "../assets/images/Girl with laptop.svg";

import iconTextbooks from "../assets/images/undraw_road-to-knowledge_f9zn.svg";
import iconAnswers from "../assets/images/undraw_artificial-intelligence_43qa.svg";
import iconSummaries from "../assets/images/undraw_taking-notes_oyqz.svg";
import iconQuizzes from "../assets/images/undraw_online-learning_tgmv.svg";
import iconPractice from "../assets/images/undraw_deep-work_muov.svg";
import iconMindMaps from "../assets/images/undraw_adventure-map_3e4p.svg";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-root">
      <div className="container">

        {/* HERO */}
        <section className="hero">
          <div className="hero-text">
            <span className="badge">Offline Study Companion</span>

            <h1>
              Your personal <br />
              <span className="gradient-text">AI study space</span>
            </h1>

            <p>
              Study calmly. Ask questions. Practice deeply.
              Everything works offline.
            </p>
          </div>

          <div className="hero-image">
            <img src={heroImage} alt="Study Illustration" />
          </div>
        </section>

        {/* ROLES */}
        <section className="roles">
          <h2>Choose your role</h2>

          <div className="role-grid">
            <div className="role-card" onClick={() => navigate("/student/login")}>
              <div className="role-icon">
                <GraduationCap size={30} />
              </div>
              <h3>Student</h3>
              <p>Learn, revise, and practice</p>
              <button className="btn-primary">
                Enter Study Space <ArrowRight size={16} />
              </button>
            </div>

            <div className="role-card" onClick={() => navigate("/teacher")}>
              <div className="role-icon muted">
                <Users size={30} />
              </div>
              <h3>Teacher</h3>
              <p>Manage textbooks and classes</p>
              <button className="btn-secondary">
                Manage Library <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features">
          <h2>What you can do</h2>

          <div className="feature-grid">
            <FeatureCard icon={iconTextbooks} title="Digital Textbooks" desc="Read and search instantly" />
            <FeatureCard icon={iconAnswers} title="Instant Answers" desc="Ask and understand" />
            <FeatureCard icon={iconSummaries} title="Chapter Summaries" desc="Revise faster" />
            <FeatureCard icon={iconQuizzes} title="Auto Quizzes" desc="Test yourself" />
            <FeatureCard icon={iconPractice} title="Practice Mode" desc="Learn by doing" />
            <FeatureCard icon={iconMindMaps} title="Mind Maps" desc="See the big picture" />
          </div>
        </section>

      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="feature-card">
    <div className="feature-icon">
      <img src={icon} alt={title} />
    </div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

export default LandingPage;
