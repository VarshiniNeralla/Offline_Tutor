import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const ToolProcessingAnimation = ({ title, status, progressVal }) => {
    const [progress, setProgress] = useState(0);

    // Auto-progress simulation if no progressVal provided
    useEffect(() => {
        if (progressVal !== undefined && progressVal !== null) {
            setProgress(progressVal);
            return;
        }

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return 90;
                const inc = Math.floor(Math.random() * 3) + 1;
                return Math.min(prev + inc, 90);
            });
        }, 400);
        return () => clearInterval(interval);
    }, [progressVal]);

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
            {/* Animated Icon/Scanner */}
            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '32px' }}>
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '4px solid #e2e8f0', borderTopColor: 'var(--primary)',
                    animation: 'spin 1.5s linear infinite'
                }}></div>
                <div style={{
                    position: 'absolute', inset: '15px', borderRadius: '50%',
                    border: '4px solid #e2e8f0', borderTopColor: 'var(--primary-2)',
                    animation: 'spin 2s linear infinite reverse'
                }}></div>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    fontSize: '1.5rem'
                }}>✨</div>
            </div>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 700 }}>
                {title || "AI Processing"}
            </h3>

            {/* Progress Bar */}
            <div style={{
                width: '100%', maxWidth: '320px', height: '8px', background: '#f1f5f9',
                borderRadius: '100px', overflow: 'hidden', margin: '16px 0 8px'
            }}>
                <div style={{
                    height: '100%', width: `${progress}%`, background: 'var(--primary)',
                    borderRadius: '100px', transition: 'width 0.3s ease-out'
                }}></div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
                background: 'var(--primary-soft)', padding: '4px 12px', borderRadius: '100px'
            }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                    {Math.round(progress)}%
                </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '400px', lineHeight: 1.5 }}>
                {status || "Analyzing content and generating your study material..."}
            </p>
        </motion.div>
    );
};

export default ToolProcessingAnimation;
