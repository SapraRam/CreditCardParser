import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Upload, Download, CheckCircle, AlertCircle, CreditCard, ChevronUp, ArrowDown, Loader2, XCircle } from 'lucide-react';
import { parseStatement, ParseResponse, BankStatementData } from './services/api';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="p-2.5 rounded-full transition-all duration-300 hover:scale-110"
      style={{
        backgroundColor: 'var(--md-sys-color-surface-variant)',
        color: 'var(--md-sys-color-on-surface)'
      }}
    >
      {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
    </button>
  );
}

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeSection: string;
}

function Navbar({ theme, onToggleTheme, activeSection }: NavbarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState({ left: 0, width: 0, top: 0, height: 0, opacity: 0 });

  useEffect(() => {
    function updatePill() {
      const container = containerRef.current;
      if (!container) return;
      const activeEl = container.querySelector(`a[href="#${activeSection}"]`) as HTMLAnchorElement | null;
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const rect = activeEl.getBoundingClientRect();
        setPill({
          left: rect.left - containerRect.left,
          width: rect.width,
          top: rect.top - containerRect.top,
          height: rect.height,
          opacity: 1
        });
      } else {
        setPill((p) => ({ ...p, opacity: 0 }));
      }
    }

    updatePill();
    window.addEventListener('resize', updatePill);
    // small timeout to catch fonts/layout
    const t = setTimeout(updatePill, 50);
    return () => {
      window.removeEventListener('resize', updatePill);
      clearTimeout(t);
    };
  }, [activeSection]);

  return (
    <>
      <nav
        className="glass fixed top-4 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-500"
        style={{
          backgroundColor: theme === 'light'
            ? 'rgba(255, 255, 255, 0.8)'
            : 'rgba(30, 41, 59, 0.8)',
          borderRadius: '9999px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 gap-16">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('home');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  // fallback to top
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-3"
              aria-label="Go to home"
            >
              <div
                className="p-2 rounded-xl"
                style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}
              >
                <CreditCard
                  size={28}
                  style={{ color: 'var(--md-sys-color-primary)' }}
                />
              </div>
              <span
                className="text-2xl font-bold"
                style={{ color: 'var(--md-sys-color-primary)' }}
              >
                CC Parser
              </span>
            </a>

            <div className="relative" ref={containerRef}>
              {/* animated pill */}
              <div
                aria-hidden
                style={{
                  left: pill.left,
                  top: pill.top,
                  width: pill.width,
                  height: pill.height,
                  opacity: pill.opacity,
                  backgroundColor: 'var(--md-sys-color-primary)'
                }}
                className="absolute rounded-full transition-all duration-300 ease-out pointer-events-none"
              />

              <div className="flex items-center gap-6 relative z-10">
                {[
                  { id: 'upload', label: 'Upload' },
                  { id: 'results', label: 'Results' },
                  { id: 'about', label: 'About' }
                ].map((link) => {
                  const isActive = activeSection === link.id;
                  return (
                    <a
                      key={link.id}
                      href={`#${link.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(link.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`hidden md:inline-flex items-center px-5 py-2.5 rounded-full font-medium transition-colors duration-200`}
                      style={{
                        color: isActive ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {link.label}
                    </a>
                  );
                })}
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

interface VerticalNavProps {
  activeSection: string;
}

function VerticalNav({ activeSection }: VerticalNavProps) {
  const sections = [
    { id: 'upload', label: 'Upload' },
    { id: 'results', label: 'Results' },
    { id: 'about', label: 'About' }
  ];

  return (
    <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-30 hidden lg:block">
      <div className="glass p-4 rounded-full shadow-xl">
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(section.id);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="relative group"
              aria-label={`Navigate to ${section.label}`}
            >
              <div
                className={`rounded-lg transition-all duration-300 ${
                  activeSection === section.id ? 'w-5 h-12' : 'w-5 h-5'
                }`}
                style={{
                  backgroundColor: activeSection === section.id
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-outline)'
                }}
              />
              <span
                className="absolute right-8 top-1/2 transform -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 transition-opacity duration-300 pointer-events-none"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface)',
                  color: 'var(--md-sys-color-on-surface)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              >
                {section.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ScrollToTopProps {
  show: boolean;
}

function ScrollToTop({ show }: ScrollToTopProps) {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-8 right-8 lg:right-24 p-4 rounded-full shadow-2xl transition-all duration-300 z-30 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16 pointer-events-none'
      }`}
      style={{
        backgroundColor: 'var(--md-sys-color-primary)',
        color: 'var(--md-sys-color-on-primary)'
      }}
      aria-label="Scroll to top"
    >
      <ChevronUp size={24} />
    </button>
  );
}

interface ParallaxBackgroundProps {
  scrollY: number;
}

function ParallaxBackground({ scrollY }: ParallaxBackgroundProps) {
  return (
    <div className="parallax-bg">
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{
          background: 'linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary))',
          top: `${20 - scrollY * 0.3}%`,
          left: '10%',
          transform: `translateY(${scrollY * 0.5}px)`
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-20"
        style={{
          background: 'linear-gradient(225deg, var(--md-sys-color-secondary), var(--md-sys-color-primary))',
          top: `${60 - scrollY * 0.2}%`,
          right: '15%',
          transform: `translateY(${scrollY * 0.3}px)`
        }}
      />
      <div
        className="absolute w-64 h-64 rounded-full blur-3xl opacity-25"
        style={{
          background: 'linear-gradient(45deg, var(--md-sys-color-primary), var(--md-sys-color-secondary))',
          bottom: `${10 - scrollY * 0.1}%`,
          left: '50%',
          transform: `translateX(-50%) translateY(${scrollY * 0.2}px)`
        }}
      />
    </div>
  );
}

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
}

function FileUpload({ onFileUpload, isLoading = false, error }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isLoading) return; // Prevent drop during upload

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (isLoading) return; // Prevent change during upload
    
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
      // Clear the input value to allow re-uploading the same file
      e.target.value = '';
    }
  };

  const handleFile = (file: File) => {
    setUploadedFile(file);
    onFileUpload(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`glass relative rounded-3xl p-12 text-center transition-all duration-300 ${
          dragActive ? 'scale-105 shadow-2xl' : 'shadow-xl'
        }`}
        style={{
          backgroundColor: dragActive
            ? 'var(--md-sys-color-primary-container)'
            : 'var(--md-sys-color-surface)'
        }}
      >
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
          disabled={isLoading}
          aria-label="Upload credit card statement PDF"
        />

        <div className="flex flex-col items-center gap-4">
          <div
            className="p-6 rounded-full"
            style={{
              backgroundColor: 'var(--md-sys-color-primary-container)',
              animation: dragActive ? 'float 2s ease-in-out infinite' : 'none'
            }}
          >
            <Upload
              size={64}
              style={{ color: 'var(--md-sys-color-primary)' }}
            />
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Upload Credit Card Statement
            </h3>
            <p className="text-lg mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Drag and drop your PDF here, or click to browse
            </p>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Maximum file size: 10MB • PDF only
            </p>
          </div>

          <label
            htmlFor="file-upload"
            className={`cursor-pointer px-8 py-4 rounded-full font-medium shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center gap-3 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)'
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Choose File'
            )}
          </label>
        </div>
      </div>

      {uploadedFile && (
        <div
          className="glass mt-6 p-5 rounded-2xl flex items-center gap-4 shadow-xl"
          style={{
            backgroundColor: 'var(--md-sys-color-success-container)',
            color: 'var(--md-sys-color-on-success-container)'
          }}
        >
          <CheckCircle size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">{uploadedFile.name}</p>
            <p className="text-sm opacity-80">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="glass mt-6 p-5 rounded-2xl flex items-center gap-4 shadow-xl"
          style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)'
          }}
        >
          <XCircle size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResultsCardProps {
  data: BankStatementData;
  bank: string;
  onDownload: () => void;
}

// Helper function to get issuer display name
function getIssuerName(bank: string): string {
  return bank || 'Unknown Bank';
}

function ResultsCard({ data, bank, onDownload }: ResultsCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cardRef} className="w-full">
      <div
        className={`glass rounded-3xl p-5 md:p-6 shadow-2xl transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
        style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold mb-5"
          style={{ color: 'var(--md-sys-color-primary)' }}
        >
          Analysis Results
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Card Issuer */}
          <div
            className={`glass p-6 rounded-3xl shadow-2xl transition-all duration-500 flex flex-col justify-between overflow-hidden relative ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              minHeight: '180px',
              transitionDelay: isVisible ? '0ms' : '0ms'
            }}
          >
            {/* Decorative Circle */}
            <div 
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 bg-white"
            ></div>
            
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider mb-3 font-bold opacity-90 text-purple-100">
                Card Issuer
              </p>
              <p className="text-2xl md:text-3xl font-black leading-tight text-white">
                {getIssuerName(bank)}
              </p>
            </div>
          </div>

          {/* Available Credit */}
          <div
            className={`glass p-6 rounded-3xl shadow-2xl transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              minHeight: '180px',
              transitionDelay: isVisible ? '100ms' : '0ms'
            }}
          >
            {/* Credit Card Chip Effect */}
            <div className="absolute top-3 right-3 w-10 h-8 rounded-md opacity-30 bg-white" style={{
              boxShadow: '0 2px 8px rgba(255, 255, 255, 0.3)'
            }}></div>
            
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider mb-3 font-bold opacity-90 text-orange-100">
                Available Credit
              </p>
              <p className="text-2xl md:text-3xl font-black text-white">
                {data.available_credit || 'N/A'}
              </p>
            </div>
          </div>

          {/* Credit Limit */}
          <div
            className={`glass p-6 rounded-3xl shadow-2xl transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              minHeight: '180px',
              transitionDelay: isVisible ? '200ms' : '0ms'
            }}
          >
            {/* Calendar Icon Effect */}
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-white"></div>
            
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider mb-3 font-bold text-emerald-100">
                Credit Limit
              </p>
              <p className="text-2xl md:text-3xl font-black text-white leading-tight">
                {data.credit_limit || 'N/A'}
              </p>
            </div>
          </div>

          {/* Payment Due Date */}
          <div
            className={`glass p-6 rounded-3xl shadow-2xl transition-all duration-500 flex flex-col justify-between overflow-hidden relative ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{
              background: 'linear-gradient(135deg, var(--md-sys-color-error-container), var(--md-sys-color-secondary-container))',
              minHeight: '180px',
              transitionDelay: isVisible ? '300ms' : '0ms'
            }}
          >
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 bg-white"></div>
            
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider mb-3 font-bold opacity-80" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
                Payment Due Date
              </p>
              <p className="text-2xl md:text-3xl font-black" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
                {data.payment_due_date || 'N/A'}
              </p>
            </div>
          </div>

          {/* Total Balance - Full Width */}
          <div
            className={`glass p-7 rounded-3xl shadow-2xl transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{
              background: 'linear-gradient(135deg, var(--md-sys-color-primary-container), var(--md-sys-color-secondary-container))',
              transitionDelay: isVisible ? '400ms' : '0ms'
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider mb-3 font-bold opacity-80" style={{ color: 'var(--md-sys-color-primary)' }}>
                  Payment Due
                </p>
                <p className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--md-sys-color-primary)' }}>
                  { data.new_balance || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onDownload}
          className="w-full md:w-auto px-8 py-4 rounded-full font-medium shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 hover:scale-105"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)'
          }}
          aria-label="Download analysis results as JSON"
        >
          <Download size={24} />
          Download Analysis (JSON)
        </button>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [analysisData, setAnalysisData] = useState<BankStatementData | null>(null);
  const [bankName, setBankName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [activeSection, setActiveSection] = useState('home');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isUploadingRef = useRef(false); // Prevent concurrent uploads

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
  const windowHeight = window.innerHeight;

  setScrollY(currentScrollY);

  setShowScrollTop(currentScrollY > windowHeight * 0.5);

      const sections = ['home', 'upload', 'results', 'about'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    // run once immediately (helps when reloading with anchor/hash)
    // If there's a hash in the URL, set activeSection immediately from it (helps with restore-on-reload)
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      if (id) setActiveSection(id);
    }
    handleScroll();
    // run shortly after to account for browser auto-scroll to hash
    const initTimer = setTimeout(handleScroll, 50);

    window.addEventListener('scroll', handleScroll, { passive: true });
    // also update on full window load (in case images/fonts change layout)
    window.addEventListener('load', handleScroll, { passive: true });
    // update when the hash changes (user navigates or reloads to a hash)
    window.addEventListener('hashchange', handleScroll, { passive: true });

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('load', handleScroll);
      window.removeEventListener('hashchange', handleScroll);
    };
  }, []);

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleFileUpload = async (file: File) => {
    // Prevent concurrent uploads
    if (isUploadingRef.current) {
      console.warn('Upload already in progress, ignoring duplicate request');
      return;
    }

    // Reset states
    setError(null);
    setAnalysisData(null);
    setBankName('');
    setHasUploadedFile(false);

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    // Validate file size (16MB to match backend)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size exceeds 16MB limit');
      return;
    }

    // Start loading
    isUploadingRef.current = true;
    setIsLoading(true);

    try {
      // Call backend API
      const response = await parseStatement(file);

      if (response.success && response.data) {
        setAnalysisData(response.data);
        setBankName(response.bank || 'Unknown Bank');
        setHasUploadedFile(true);
        setError(null);

        // Scroll to results after short delay
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      } else {
        setError(response.error || 'Failed to parse PDF. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
      isUploadingRef.current = false;
    }
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `statement_analysis_${timestamp}.json`;

    const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      <ParallaxBackground scrollY={scrollY} />

      <Navbar
        theme={theme}
        onToggleTheme={handleThemeToggle}
        activeSection={activeSection}
      />

      <VerticalNav activeSection={activeSection} />

      <ScrollToTop show={showScrollTop} />

      {/* Home section with project description - clicking logo scrolls here */}
      <section
        id="home"
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8  relative"
      >
        <div className="max-w-4xl mx-auto text-center">
            <h1
            className="text-4xl md:text-5xl font-extrabold mb-6"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
          >
            Credit Card Statement Parser
          </h1>
            <div
              className="glass p-8 rounded-3xl mx-auto max-w-3xl"
              style={{
                backgroundColor: 'var(--md-sys-color-surface)',
                border: theme === 'light' ? '1px solid rgba(255,255,255,0.7)' : undefined
              }}
            >

              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            A lightweight demo app that extracts and displays key details from your credit card statements.
            Upload a PDF statement to see parsed results such as cardholder, billing cycle, payment due dates, and
            outstanding balances. This demo runs in your browser using mock parsing logic for illustration.
          </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="#upload"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('upload');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-block px-6 py-3 rounded-full font-medium shadow-lg transition-all duration-300 hover:scale-105"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                >
                  Get Started
                </a>

                <a
                  href="#about"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('about');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-block px-6 py-3 rounded-full font-medium glass transition-all duration-300 border"
                  style={{ color: 'var(--md-sys-color-on-surface)', borderColor: 'var(--md-sys-color-outline)' }}
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

      <section
        id="upload"
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative"
        style={{ scrollMarginTop: '96px' }}
      >
        <div className="w-full max-w-6xl">
          <h2
            className="text-4xl md:text-5xl font-bold text-center mb-12 fade-in-up"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
          >
            Upload Your Statement
          </h2>
          <FileUpload 
            onFileUpload={handleFileUpload} 
            isLoading={isLoading}
            error={error}
          />
        </div>
      </section>

      <section
        id="results"
        className="flex items-center justify-center px-4 sm:px-6 lg:px-8 relative"
        style={{ 
          scrollMarginTop: '96px',
          minHeight: '100vh',
          paddingBottom: '80px'
        }}
      >
        <div className="w-full max-w-6xl mx-auto">
          {isLoading ? (
            <div className="text-center max-w-2xl mx-auto glass p-12 rounded-3xl shadow-xl" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
              <Loader2 size={80} className="mx-auto mb-6 animate-spin" style={{ color: 'var(--md-sys-color-primary)' }} />
              <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Processing Your Statement
              </h2>
              <p className="text-lg" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Please wait while we extract data from your PDF...
              </p>
            </div>
          ) : hasUploadedFile && analysisData ? (
            <ResultsCard data={analysisData} bank={bankName} onDownload={handleDownload} />
          ) : (
            <div className="text-center max-w-2xl mx-auto glass p-12 rounded-3xl shadow-xl" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
              <AlertCircle size={80} className="mx-auto mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }} />
              <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                No Results Available
              </h2>
              <p className="text-lg mb-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Please upload a credit card statement PDF to view analysis results.
              </p>
              <a
                href="#upload"
                className="inline-block px-8 py-4 rounded-full font-medium shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)'
                }}
              >
                Upload Statement
              </a>
            </div>
          )}
        </div>
      </section>

      <section
        id="about"
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20 relative"
        style={{ scrollMarginTop: '96px' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-4xl md:text-5xl font-bold mb-10 fade-in-up"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
          >
            About This Tool
          </h2>
          <div
            className="glass rounded-3xl p-10 space-y-6 shadow-2xl"
            style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
          >
            <p className="text-lg md:text-xl leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              The Credit Card Statement Parser is a user-friendly web application designed to help you
              quickly extract and analyze key information from your credit card statements.
            </p>
            <p className="text-lg md:text-xl leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Simply upload your PDF statement, and our tool will parse and display important details
              including cardholder information, billing cycles, payment due dates, and total balance due.
            </p>
            
            {/* Advantages block merged here */}
            <div className="pt-4">
              <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Advantages of Credit Cards
              </h3>

              <p className="text-lg md:text-xl leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Credit cards offer a range of benefits that make them useful tools for everyday spending and financial management:
              </p>

              <ul className="list-disc pl-6 space-y-3 text-lg md:text-xl" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <li>
                  <strong>Rewards & Cash Back:</strong> Earn points, miles, or cash back on purchases which can offset costs or be redeemed for travel, statement credits, or gift cards.
                </li>
                <li>
                  <strong>Fraud Protection:</strong> Many cards offer strong liability protection and fast dispute resolution for unauthorized transactions.
                </li>
                <li>
                  <strong>Purchase & Travel Protections:</strong> Extended warranties, purchase protection, price protection, travel insurance, and trip cancellation/interruption coverage are common perks.
                </li>
              </ul>

              <div className="pt-6 mt-6" style={{ borderTop: '1px solid var(--md-sys-color-outline)' }}>
                <p className="text-base" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Use cards responsibly: pay on time, monitor statements, and avoid carrying high balances to maximize benefits while minimizing interest costs.
                </p>
              </div>
            </div>
            <div
              className="pt-6 mt-6"
              style={{ borderTop: '1px solid var(--md-sys-color-outline)' }}
            >
              <p className="text-base" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Built with modern web technologies and Material Design 3 principles for an exceptional user experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      

      <footer
        className="py-8 text-center relative"
        style={{
          borderTop: '1px solid var(--md-sys-color-outline)',
          backgroundColor: 'var(--md-sys-color-surface)'
        }}
      >
        <p className="text-base" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          CC Parser v1.0 • Built with Material Design 3
        </p>
      </footer>
    </div>
  );
}

export default App;
