import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

// Configure PDF worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { bookId, bookName, initialPage = 1 } = location.state || {};

  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  const pdfUrl = `/api/book/${bookId}`;

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  // Scroll to initial page once loaded
  React.useEffect(() => {
    if (!loading && numPages && initialPage) {
      setTimeout(() => {
        const pageElement = document.getElementById(`page_${initialPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500); // Small delay to ensure rendering
    }
  }, [loading, numPages, initialPage]);

  const zoomIn = () => setScale(prev => Math.min(2.0, prev + 0.2));
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      backgroundColor: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    bookTitle: { color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 },
    controls: { display: 'flex', alignItems: 'center', gap: '8px' },
    button: {
      padding: '8px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#cbd5e1',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s'
    },
    zoomText: { color: '#cbd5e1', fontSize: '14px', fontWeight: '500', minWidth: '60px', textAlign: 'center' },
    mainContent: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: '#0f172a',
      scrollBehavior: 'smooth'
    },
    pdfWrapper: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      alignItems: 'center'
    },
    pageContainer: {
      backgroundColor: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    },
    loadingContainer: {
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%'
    }
  };

  if (!bookId) return null;

  return (
    <div style={styles.container}>
      <style>{`
        .pdf-page canvas {
            display: block;
            max-width: 100%;
            height: auto !important;
        }
      `}</style>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate(-1)} style={styles.button}><X size={20} /></button>
          <h1 style={styles.bookTitle}>{bookName || 'PDF Viewer'}</h1>
        </div>
        <div style={styles.controls}>
          <button onClick={zoomOut} style={styles.button}><ZoomOut size={18} /></button>
          <span style={styles.zoomText}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} style={styles.button}><ZoomIn size={18} /></button>
        </div>
      </header>

      <main style={styles.mainContent}>
        <div style={styles.pdfWrapper}>
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div style={styles.loadingContainer}>Loading PDF...</div>}
            options={React.useMemo(() => ({
              cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
              cMapPacked: true,
              standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/'
            }), [])}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div
                key={`page_${index + 1}`}
                id={`page_${index + 1}`}
                style={styles.pageContainer}
              >
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="pdf-page"
                  loading={<div>Loading page...</div>}
                />
              </div>
            ))}
          </Document>
        </div>
      </main>
    </div>
  );
};

export default PDFViewer;
