import React, { useEffect, useState } from 'react';
import logo from '../assets/apparent_logo.jpeg';

const LandingPage = () => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleNavigate = (path) => {
        window.open(path, '_blank');
    };

    return (
        <div style={styles.container}>
            {/* Ambient Background Glow - adjusted for light mode */}
            <div style={styles.ambientGlow} />

            {/* Navigation */}
            <nav style={{ ...styles.nav, opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease-out' }}>
                <div style={styles.logoContainer}>
                    <img src={logo} alt="Apparent Energy" style={styles.logo} />
                </div>
                <div style={styles.navLinks}>
                    <button onClick={() => handleNavigate('/dashboard')} className="nav-link" style={styles.navLink}>
                        Dashboard
                    </button>
                    <button onClick={() => handleNavigate('/simulation')} className="nav-link" style={styles.navLink}>
                        Simulation
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <main style={styles.main}>
                <div style={styles.heroContent}>
                    <h1 style={{
                        ...styles.title,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1), transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                        Grid
                        <br />
                        Intelligence.
                    </h1>
                    <p style={{
                        ...styles.subtitle,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1) 0.2s, transform 1s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
                    }}>
                        Simulation and monitoring for the modern energy infrastructure.
                        <br />
                        Precision assets. Mapping. Fault analysis.
                    </p>
                </div>

                {/* Feature Grid - "Quiet" Cards */}
                <div style={styles.grid}>
                    <Feature
                        title="Visualization"
                        desc="Real-time rendering of complex electrical networks with sub-meter precision."
                        delay={0.4}
                        mounted={mounted}
                    />
                    <Feature
                        title="Simulation"
                        desc="Advanced sensor placement logic and voltage class mapping."
                        delay={0.5}
                        mounted={mounted}
                    />
                    <Feature
                        title="Analysis"
                        desc="Instant fault detection and grid energization feedback loops."
                        delay={0.6}
                        mounted={mounted}
                    />
                </div>
            </main>

            {/* Minimal Footer */}
            <footer style={{ ...styles.footer, opacity: mounted ? 1 : 0, transition: 'opacity 1s ease-out 0.8s' }}>
                <span style={styles.copyright}>Apparent Energy &copy; 2026</span>
                <span style={styles.badge}>Official Product</span>
            </footer>
        </div>
    );
};

const Feature = ({ title, desc, delay, mounted }) => (
    <div
        className="feature-card"
        style={{
            ...styles.featureCard,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`,
        }}
    >
        <h3 style={styles.featureTitle}>{title}</h3>
        <p style={styles.featureDesc}>{desc}</p>
    </div>
);

const styles = {
    container: {
        backgroundColor: '#ffffff',
        color: '#000000', // Pure black
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        position: 'relative',
    },
    ambientGlow: {
        position: 'absolute',
        top: '-30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '70vw',
        height: '70vh',
        background: 'radial-gradient(circle, rgba(129, 140, 248, 0.08) 0%, rgba(255,255,255,0) 70%)', // Very subtle
        pointerEvents: 'none',
        zIndex: 0,
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '40px 60px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.95)', // Increased opacity for readability
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
    },
    logoContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logo: {
        height: '32px',
        borderRadius: '6px',
        opacity: 1,
    },
    navLinks: {
        display: 'flex',
        gap: '32px',
    },
    navLink: {
        background: 'none',
        border: 'none',
        color: '#000000', // Black links
        fontSize: '14px',
        fontWeight: '600', // Bolder
        cursor: 'pointer',
        transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '8px 0',
        letterSpacing: '-0.01em',
    },
    main: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '160px 20px 80px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        zIndex: 1,
    },
    heroContent: {
        textAlign: 'center',
        marginBottom: '140px',
    },
    title: {
        fontSize: '120px',
        fontWeight: '800', // Extra bold
        lineHeight: '0.95',
        letterSpacing: '-0.04em',
        margin: '0 0 30px 0',
        color: '#000000', // Fallback
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)', // Subtle black gradient
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        willChange: 'transform, opacity',
    },
    subtitle: {
        fontSize: '22px',
        lineHeight: '1.6',
        color: '#1f2937', // Gray-800 - much darker
        fontWeight: '500', // Slightly heavier
        maxWidth: '580px',
        margin: '0 auto',
        letterSpacing: '-0.02em',
        willChange: 'transform, opacity',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        width: '100%',
        padding: '0 40px',
    },
    featureCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        textAlign: 'left',
        padding: '32px',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb', // Explicit light gray border
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default',
    },
    featureTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#000000', // Black
        margin: 0,
        letterSpacing: '-0.01em',
    },
    featureDesc: {
        fontSize: '15px',
        lineHeight: '1.6',
        color: '#374151', // Gray-700
        margin: 0,
    },
    footer: {
        padding: '40px 60px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #f3f4f6',
        marginTop: 'auto',
        zIndex: 1,
    },
    copyright: {
        color: '#000000',
        fontSize: '12px',
        fontWeight: '500',
    },
    badge: {
        color: '#000000',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    }
};

/* Semantic CSS injection for advanced interactions and media queries */
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }

  /* Hover: Active color #4f46e5 (Indigo-600) for better visibility on white */
  .nav-link:hover {
    color: #4f46e5 !important;
  }

  /* Card Hover */
  .feature-card:hover {
    background-color: #ffffff !important;
    border-color: rgba(79, 70, 229, 0.2) !important;
    transform: translateY(-4px) !important;
    box-shadow: 0 20px 40px -10px rgba(79, 70, 229, 0.15); /* Stronger shadow for light mode */
  }

  .feature-card:hover h3 {
    color: #4f46e5 !important;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    
    .feature-card:hover {
      transform: none !important;
    }
  }

  @media (max-width: 768px) {
    .nav { padding: 20px 20px !important; }
    .grid { padding: 0 20px !important; }
    .title { fontSize: 64px !important; }
    .main { padding-top: 120px !important; }
  }
`;
document.head.appendChild(styleSheet);

export default LandingPage;
