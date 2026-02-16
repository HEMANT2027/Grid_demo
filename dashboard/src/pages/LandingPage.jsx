import React, { useEffect, useState } from 'react';
import { Sparkles, Activity, Zap, Cpu } from 'lucide-react';
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
            {/* Navigation */}
            <nav style={{ ...styles.nav, opacity: mounted ? 1 : 0 }}>
                <div style={styles.logoContainer}>
                    <img src={logo} alt="Apparent Energy" style={styles.logo} />
                    <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: '#fff' }}>
                        APPARENT ENERGY
                    </span>
                </div>
                <div style={styles.navLinks}>
                    <button onClick={() => handleNavigate('/dashboard')} className="nav-link" style={styles.navLink}>
                        Dashboard
                    </button>
                    <button onClick={() => handleNavigate('/simulation')} className="nav-link" style={styles.navLink}>
                        Simulation Lab
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <main style={styles.main}>
                <div style={styles.heroContent}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <h1 style={{ ...styles.title, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)' }}>
                            Future Grid<br />Intelligence.
                        </h1>
                        {mounted && <div style={styles.glowEffect} />}
                    </div>

                    <p style={{ ...styles.subtitle, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)' }}>
                        Experience the next generation of power infrastructure management.
                        Our platform combines sub-meter precision mapping with real-time fault detection algorithms,
                        enabling operators to visualize, simulate, and optimize complex electrical networks with unprecedented clarity.
                        From proactive sensor placement to instant grid energization feedback, we empower a smarter, more resilient energy future.
                    </p>

                    <div style={{ ...styles.ctaGroup, opacity: mounted ? 1 : 0 }}>
                        <button onClick={() => handleNavigate('/dashboard')} style={styles.primaryBtn}>
                            Launch Dashboard
                        </button>
                        <button onClick={() => handleNavigate('/simulation')} style={styles.secondaryBtn}>
                            Explore Simulation
                        </button>
                    </div>
                </div>

                {/* Feature Grid */}
                <div style={styles.grid}>
                    <Feature
                        icon={<Sparkles size={24} color="#00ff9d" />}
                        title="Visualization"
                        desc="Render complex transmission networks with immersive high-fidelity maps and real-time state overlays."
                        delay={0.4}
                        mounted={mounted}
                    />
                    <Feature
                        icon={<Cpu size={24} color="#d946ef" />}
                        title="Simulation Core"
                        desc="Advanced logic for sensor placement and voltage propagation, ensuring optimal coverage and reliability."
                        delay={0.5}
                        mounted={mounted}
                    />
                    <Feature
                        icon={<Activity size={24} color="#ff0055" />}
                        title="Fault Analysis"
                        desc="Instantaneous detection and isolation of grid faults with predictive impact analysis and reporting."
                        delay={0.6}
                        mounted={mounted}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer style={styles.footer}>
                <span style={styles.copyright}>Apparent Energy &copy; 2026</span>
                <div style={styles.statusDot}>
                    <span style={styles.dot} /> Systems Operational
                </div>
            </footer>
        </div>
    );
};

const Feature = ({ icon, title, desc, delay, mounted }) => (
    <div
        className="feature-card"
        style={{
            ...styles.featureCard,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transitionDelay: `${delay}s`,
        }}
    >
        <div style={styles.iconBox}>{icon}</div>
        <h3 style={styles.featureTitle}>{title}</h3>
        <p style={styles.featureDesc}>{desc}</p>
    </div>
);

const styles = {
    container: {
        backgroundColor: '#050505',
        color: '#ededed',
        minHeight: '100vh',
        fontFamily: '"Inter", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 20, 20, 1) 0%, #050505 60%)',
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '32px 60px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        transition: 'opacity 0.8s ease-out',
    },
    logoContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logo: {
        height: '36px',
        borderRadius: '8px',
    },
    navLinks: {
        display: 'flex',
        gap: '40px',
    },
    navLink: {
        background: 'none',
        border: 'none',
        color: '#a1a1aa', // Muted text
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'color 0.2s',
        padding: 0,
    },
    main: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '180px 20px 100px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        zIndex: 10,
    },
    heroContent: {
        textAlign: 'center',
        marginBottom: '100px',
        maxWidth: '800px',
    },
    title: {
        fontSize: '96px',
        fontWeight: '800',
        lineHeight: '1',
        letterSpacing: '-0.04em',
        margin: '0 0 32px 0',
        background: 'linear-gradient(180deg, #ffffff 0%, #666666 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        transition: 'all 1s cubic-bezier(0.2, 0.8, 0.2, 1)',
        position: 'relative',
        zIndex: 2,
    },
    glowEffect: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '120%',
        height: '120%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)',
        zIndex: 1,
        pointerEvents: 'none',
    },
    subtitle: {
        fontSize: '18px',
        lineHeight: '1.7',
        color: '#a1a1aa',
        fontWeight: '400',
        maxWidth: '700px',
        margin: '0 auto 48px',
        transition: 'all 1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s',
    },
    ctaGroup: {
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        transition: 'opacity 1s ease-out 0.4s',
    },
    primaryBtn: {
        padding: '14px 32px',
        background: '#fff',
        color: '#000',
        border: 'none',
        borderRadius: '50px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 0 20px rgba(255,255,255,0.2)',
    },
    secondaryBtn: {
        padding: '14px 32px',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '50px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '32px',
        width: '100%',
        padding: '0 20px',
    },
    featureCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'left',
        padding: '32px',
        borderRadius: '24px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #1f1f1f',
        cursor: 'default',
        transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
    },
    iconBox: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '8px',
    },
    featureTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#fff',
        margin: 0,
        letterSpacing: '-0.01em',
    },
    featureDesc: {
        fontSize: '15px',
        lineHeight: '1.6',
        color: '#71717a',
        margin: 0,
    },
    footer: {
        padding: '40px 60px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #141414',
        marginTop: 'auto',
    },
    copyright: {
        color: '#52525b',
        fontSize: '13px',
    },
    statusDot: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#00ff9d',
        fontSize: '12px',
        fontWeight: '500',
        fontFamily: '"JetBrains Mono", monospace',
    },
    dot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: '#00ff9d',
        boxShadow: '0 0 10px #00ff9d',
    }
};

/* Inject styling for hover states */
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .nav-link:hover { color: #fff !important; }
  
  .feature-card:hover {
    transform: translateY(-8px) !important;
    border-color: rgba(255,255,255,0.15) !important;
    background-color: #0f0f0f !important;
    box-shadow: 0 20px 40px -20px rgba(0,0,0,0.8);
  }
  
  .primaryBtn:hover {
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    .title { font-size: 56px !important; }
    .nav { padding: 20px !important; }
    .grid { padding: 0 !important; }
  }
`;
document.head.appendChild(styleSheet);

export default LandingPage;
