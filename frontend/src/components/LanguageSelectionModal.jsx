import React from "react";
import { Languages, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "../assets/styles/language-modal.css";

const LanguageSelectionModal = ({ isOpen, onClose, onSelectLanguage }) => {
  const handleLanguageSelect = (lang) => {
    onSelectLanguage(lang);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="language-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="language-modal"
            initial={{ scale: 0.95, opacity: 0, x: "-50%", y: "-50%" }}
            animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
            exit={{ scale: 0.95, opacity: 0, x: "-50%", y: "-50%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <button className="language-modal-close" onClick={onClose}>
              <X size={20} />
            </button>

            <div className="language-modal-header">
              <Languages size={48} className="language-modal-icon" />
              <h2>Choose Your Language</h2>
              <p>Select the language you want to proceed with</p>
            </div>

            <div className="language-options">
              <motion.button
                className="language-option english"
                onClick={() => handleLanguageSelect("english")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="language-flag">EN</div>
                <div className="language-info">
                  <h3>English</h3>
                  <p>Continue in English</p>
                </div>
              </motion.button>

              <motion.button
                className="language-option telugu"
                onClick={() => handleLanguageSelect("telugu")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="language-flag">TE</div>
                <div className="language-info">
                  <h3>తెలుగు (Telugu)</h3>
                  <p>తెలుగులో కొనసాగండి</p>
                </div>
              </motion.button>
            </div>

            <div className="language-modal-note">
              <p>
                <strong>Note:</strong> Once selected, all content, speech
                recognition, and AI responses will be in your chosen language.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LanguageSelectionModal;
