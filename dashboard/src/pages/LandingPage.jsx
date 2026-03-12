import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Activity, Zap, Cpu, ArrowRight, ChevronRight, BarChart3, MapPin } from 'lucide-react';
import logo from '../assets/apparent_logo.jpeg';

/* ═══════════════════════════════════════════
   Landing Page — Light Professional Theme
   Premium design with subtle animations
   ═══════════════════════════════════════════ */

/* ── Interactive Energy Grid Canvas ── */
const EnergyGridCanvas = () => {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animRef = useRef(null);
    const nodesRef = useRef([]);
    const particlesRef = useRef([]);
    const pulsesRef = useRef([]);
    const sparksRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        /* ── Sizing ── */
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * 1.2 * dpr;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = (window.innerHeight * 1.2) + 'px';
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener('resize', resize);

        /* ── Create grid nodes ── */
        const W = window.innerWidth;
        const H = window.innerHeight * 1.2;
        const NODE_COUNT = Math.min(65, Math.floor(W * H / 16000));
        const CURSOR_FIELD = 220;      // cursor influence radius
        const CONNECTION_DIST = 160;

        const nodes = [];
        for (let i = 0; i < NODE_COUNT; i++) {
            const isSubstation = Math.random() < 0.15;
            nodes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.18,
                vy: (Math.random() - 0.5) * 0.12,
                radius: isSubstation ? 3.5 : 1.8,
                isSubstation,
                pulsePhase: Math.random() * Math.PI * 2,
                baseAlpha: isSubstation ? 0.3 : 0.14,
                energized: 0,  // 0–1 how energized by cursor
            });
        }
        nodesRef.current = nodes;

        /* ── Create energy particles ── */
        const particles = [];
        for (let i = 0; i < 28; i++) {
            particles.push(spawnParticle(nodes, W, H));
        }
        particlesRef.current = particles;

        /* ── Pulse rings from cursor ── */
        const pulses = pulsesRef.current;
        let lastPulseTime = 0;

        /* ── Spark particles on click ── */
        const sparks = sparksRef.current;

        /* ── Mouse tracking ── */
        const onMouseMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY + window.scrollY };
        };
        window.addEventListener('mousemove', onMouseMove);

        /* ── Click: energy burst ── */
        const onClick = (e) => {
            const mx = e.clientX;
            const my = e.clientY + window.scrollY;
            // Spawn pulse ring
            pulses.push({ x: mx, y: my, r: 0, maxR: 180, alpha: 0.4, speed: 3.5 });
            // Spawn sparks
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i + (Math.random() - 0.5) * 0.5;
                const speed = 1.5 + Math.random() * 3;
                sparks.push({
                    x: mx, y: my,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    decay: 0.015 + Math.random() * 0.01,
                });
            }
        };
        window.addEventListener('click', onClick);

        /* ── Animation loop ── */
        let time = 0;

        const animate = () => {
            const w = window.innerWidth;
            const h = window.innerHeight * 1.2;
            ctx.clearRect(0, 0, w, h);
            time += 0.008;
            const mouse = mouseRef.current;
            const scrollTop = window.scrollY;
            const mxCanvas = mouse.x;
            const myCanvas = mouse.y - scrollTop * 0.3;

            // Auto-emit pulse rings periodically near cursor
            if (time - lastPulseTime > 1.8 && mouse.x > 0) {
                pulses.push({ x: mxCanvas, y: myCanvas, r: 0, maxR: 140, alpha: 0.15, speed: 1.5 });
                lastPulseTime = time;
            }

            /* Move nodes & compute energization */
            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;

                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
                n.x = Math.max(0, Math.min(w, n.x));
                n.y = Math.max(0, Math.min(h, n.y));

                // Cursor proximity → energization
                const dx = n.x - mxCanvas;
                const dy = n.y - myCanvas;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const targetEnergy = dist < CURSOR_FIELD ? Math.pow(1 - dist / CURSOR_FIELD, 1.5) : 0;
                n.energized += (targetEnergy - n.energized) * 0.08; // smooth lerp

                // Gentle attract toward cursor when close
                if (dist < CURSOR_FIELD && dist > 30) {
                    const attract = (CURSOR_FIELD - dist) / CURSOR_FIELD * 0.06;
                    n.x -= (dx / dist) * attract;
                    n.y -= (dy / dist) * attract;
                }
            }

            /* ── Draw cursor energy field ── */
            if (mouse.x > 0) {
                const fieldGrad = ctx.createRadialGradient(mxCanvas, myCanvas, 0, mxCanvas, myCanvas, CURSOR_FIELD);
                fieldGrad.addColorStop(0, 'rgba(26, 86, 219, 0.04)');
                fieldGrad.addColorStop(0.5, 'rgba(14, 159, 110, 0.02)');
                fieldGrad.addColorStop(1, 'rgba(26, 86, 219, 0)');
                ctx.beginPath();
                ctx.arc(mxCanvas, myCanvas, CURSOR_FIELD, 0, Math.PI * 2);
                ctx.fillStyle = fieldGrad;
                ctx.fill();
            }

            /* ── Draw node-to-node connections (dim) ── */
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const baseAlpha = (1 - dist / CONNECTION_DIST) * 0.06;
                        // Brighten if both nodes are energized
                        const energyBoost = Math.min(a.energized, b.energized);
                        const alpha = baseAlpha + energyBoost * 0.25;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        if (energyBoost > 0.1) {
                            ctx.strokeStyle = `rgba(14, 159, 110, ${alpha})`;
                            ctx.lineWidth = 0.8 + energyBoost * 1.5;
                        } else {
                            ctx.strokeStyle = `rgba(26, 86, 219, ${alpha})`;
                            ctx.lineWidth = 0.7;
                        }
                        ctx.stroke();
                    }
                }
            }

            /* ── Draw cursor → node connections (vivid power lines) ── */
            if (mouse.x > 0) {
                for (const n of nodes) {
                    if (n.energized > 0.05) {
                        ctx.beginPath();
                        ctx.moveTo(mxCanvas, myCanvas);
                        // Slight curve for organic feel
                        const midX = (mxCanvas + n.x) / 2 + Math.sin(time * 3 + n.pulsePhase) * 8;
                        const midY = (myCanvas + n.y) / 2 + Math.cos(time * 3 + n.pulsePhase) * 8;
                        ctx.quadraticCurveTo(midX, midY, n.x, n.y);
                        ctx.strokeStyle = `rgba(14, 159, 110, ${n.energized * 0.22})`;
                        ctx.lineWidth = 0.6 + n.energized * 1.2;
                        ctx.stroke();
                    }
                }
            }

            /* ── Draw nodes ── */
            for (const n of nodes) {
                const pulse = Math.sin(time * 2 + n.pulsePhase) * 0.5 + 0.5;
                const energy = n.energized;
                const alpha = n.baseAlpha + pulse * 0.1 + energy * 0.55;
                const r = n.radius + pulse * (n.isSubstation ? 1 : 0.3) + energy * 3;

                // Energized glow
                if (energy > 0.05) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r + 10 * energy, 0, Math.PI * 2);
                    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r + 10 * energy);
                    glow.addColorStop(0, `rgba(14, 159, 110, ${energy * 0.3})`);
                    glow.addColorStop(1, 'rgba(14, 159, 110, 0)');
                    ctx.fillStyle = glow;
                    ctx.fill();
                }
                // Substation glow (always)
                else if (n.isSubstation) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
                    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r + 5);
                    glow.addColorStop(0, `rgba(26, 86, 219, ${alpha * 0.25})`);
                    glow.addColorStop(1, 'rgba(26, 86, 219, 0)');
                    ctx.fillStyle = glow;
                    ctx.fill();
                }

                // Core dot
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                if (energy > 0.1) {
                    ctx.fillStyle = `rgba(14, 159, 110, ${alpha})`;
                } else if (n.isSubstation) {
                    ctx.fillStyle = `rgba(26, 86, 219, ${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(100, 116, 139, ${alpha})`;
                }
                ctx.fill();
            }

            /* ── Draw flowing particles ── */
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.t += p.speed;
                if (p.t >= 1) {
                    particles[i] = spawnParticle(nodes, w, h);
                    continue;
                }
                const x = p.fromX + (p.toX - p.fromX) * p.t;
                const y = p.fromY + (p.toY - p.fromY) * p.t;
                const fadeAlpha = Math.sin(p.t * Math.PI) * 0.5;

                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(14, 159, 110, ${fadeAlpha})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(x, y, 4.5, 0, Math.PI * 2);
                const pg = ctx.createRadialGradient(x, y, 0, x, y, 4.5);
                pg.addColorStop(0, `rgba(14, 159, 110, ${fadeAlpha * 0.3})`);
                pg.addColorStop(1, 'rgba(14, 159, 110, 0)');
                ctx.fillStyle = pg;
                ctx.fill();
            }

            /* ── Draw pulse rings ── */
            for (let i = pulses.length - 1; i >= 0; i--) {
                const p = pulses[i];
                p.r += p.speed;
                p.alpha -= 0.003;
                if (p.r > p.maxR || p.alpha <= 0) { pulses.splice(i, 1); continue; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(26, 86, 219, ${p.alpha})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            /* ── Draw sparks ── */
            for (let i = sparks.length - 1; i >= 0; i--) {
                const sp = sparks[i];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.vx *= 0.97;
                sp.vy *= 0.97;
                sp.life -= sp.decay;
                if (sp.life <= 0) { sparks.splice(i, 1); continue; }

                ctx.beginPath();
                ctx.arc(sp.x, sp.y, 1.2 + sp.life, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(14, 159, 110, ${sp.life * 0.8})`;
                ctx.fill();

                // Spark glow
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, 4 + sp.life * 3, 0, Math.PI * 2);
                const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 4 + sp.life * 3);
                sg.addColorStop(0, `rgba(14, 159, 110, ${sp.life * 0.25})`);
                sg.addColorStop(1, 'rgba(14, 159, 110, 0)');
                ctx.fillStyle = sg;
                ctx.fill();
            }

            /* ── Cursor core glow dot ── */
            if (mouse.x > 0) {
                const corePulse = Math.sin(time * 4) * 0.5 + 0.5;
                // Outer ring
                ctx.beginPath();
                ctx.arc(mxCanvas, myCanvas, 18 + corePulse * 4, 0, Math.PI * 2);
                const coreGlow = ctx.createRadialGradient(mxCanvas, myCanvas, 0, mxCanvas, myCanvas, 18 + corePulse * 4);
                coreGlow.addColorStop(0, 'rgba(26, 86, 219, 0.08)');
                coreGlow.addColorStop(0.6, 'rgba(14, 159, 110, 0.04)');
                coreGlow.addColorStop(1, 'rgba(26, 86, 219, 0)');
                ctx.fillStyle = coreGlow;
                ctx.fill();
                // Inner dot
                ctx.beginPath();
                ctx.arc(mxCanvas, myCanvas, 3 + corePulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(26, 86, 219, ${0.25 + corePulse * 0.15})`;
                ctx.fill();
            }

            animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('click', onClick);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%',
                height: '120vh',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
};

/* Helper: spawn a particle that travels between two nearby nodes */
function spawnParticle(nodes, W, H) {
    if (nodes.length < 2) return { fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, speed: 0.01 };
    const i = Math.floor(Math.random() * nodes.length);
    let j = Math.floor(Math.random() * nodes.length);
    let attempts = 0;
    while (j === i && attempts < 10) { j = Math.floor(Math.random() * nodes.length); attempts++; }
    return {
        fromX: nodes[i].x, fromY: nodes[i].y,
        toX: nodes[j].x, toY: nodes[j].y,
        t: 0,
        speed: 0.003 + Math.random() * 0.005,
    };
}


const LandingPage = () => {
    const [mounted, setMounted] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        /* Override global dark-mode overflow:hidden */
        const root = document.getElementById('root');
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        document.body.style.background = '#FAFBFD';
        document.body.style.color = '#0F172A';
        if (root) {
            root.style.height = 'auto';
            root.style.overflow = 'auto';
        }

        /* Trigger mount animations */
        const t = setTimeout(() => setMounted(true), 50);

        /* Parallax scroll listener */
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            clearTimeout(t);
            window.removeEventListener('scroll', handleScroll);
            document.body.style.overflow = '';
            document.body.style.height = '';
            document.body.style.background = '';
            document.body.style.color = '';
            if (root) {
                root.style.height = '';
                root.style.overflow = '';
            }
        };
    }, []);

    const handleNav = (path) => navigate(path);

    return (
        <div style={s.page}>
            {/* ─── Inject Animations & Fonts ─── */}
            <style>{KEYFRAMES}</style>

            {/* ─── Interactive Energy Grid Background ─── */}
            <EnergyGridCanvas />

            {/* ─── NAVBAR ─── */}
            <nav style={{
                ...s.nav,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
                backdropFilter: scrollY > 40 ? 'blur(16px) saturate(180%)' : 'none',
                background: scrollY > 40 ? 'rgba(250,251,253,0.85)' : 'transparent',
                borderBottom: scrollY > 40 ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
            }}>
                <div style={s.navInner}>
                    <div style={s.logoContainer}>
                        <img src={logo} alt="Apparent Energy" style={s.logo} />
                        <span style={s.logoText}>APPARENT ENERGY</span>
                    </div>
                    <div style={s.navLinks}>
                        <button onClick={() => handleNav('/dashboard')} style={s.navLink}>Dashboard</button>
                        <button onClick={() => handleNav('/simulation')} style={s.navLink}>Simulation</button>
                        <button onClick={() => handleNav('/sensor-predictor')} style={s.navLink}>Sensor Predictor</button>
                        <button onClick={() => handleNav('/infrastructure-planner')} style={s.navLink}>Infra Planner</button>
                        <button onClick={() => handleNav('/simulation')} style={s.navCta}>
                            Launch App <ArrowRight size={14} style={{ marginLeft: 4 }} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── HERO SECTION ─── */}
            <section style={s.hero}>
                {/* Subtle gradient orbs for visual depth */}
                <div style={{
                    ...s.orb,
                    top: '-20%', right: '-10%',
                    background: 'radial-gradient(circle, rgba(26,86,219,0.06) 0%, transparent 70%)',
                    transform: `translate(${scrollY * 0.04}px, ${scrollY * 0.02}px)`,
                }} />
                <div style={{
                    ...s.orb,
                    bottom: '-30%', left: '-15%',
                    background: 'radial-gradient(circle, rgba(14,159,110,0.05) 0%, transparent 70%)',
                    transform: `translate(${-scrollY * 0.03}px, ${-scrollY * 0.01}px)`,
                }} />

                <div style={s.heroContent}>
                    {/* Badge */}
                    <div style={{
                        ...s.badge,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
                    }}>
                        <div style={s.badgeDot} />
                        Grid Intelligence Platform
                    </div>

                    {/* Title */}
                    <h1 style={{
                        ...s.title,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(24px)',
                    }}>
                        Smarter Grids,<br />
                        <span style={s.titleAccent}>Clearer Insights.</span>
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        ...s.subtitle,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                    }}>
                        Experience next-generation power infrastructure management.
                        Sub-meter precision mapping, real-time fault detection, and intelligent
                        sensor placement — all in one unified platform.
                    </p>

                    {/* CTA buttons */}
                    <div style={{
                        ...s.ctaGroup,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
                    }}>
                        <button onClick={() => handleNav('/simulation')} style={s.primaryBtn}>
                            Launch Simulation
                            <ArrowRight size={16} />
                        </button>
                        <button onClick={() => handleNav('/dashboard')} style={s.secondaryBtn}>
                            View Dashboard
                        </button>
                    </div>

                    {/* Stats row */}
                    <div style={{
                        ...s.statsRow,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
                    }}>
                        <Stat value="500K+" label="Buses Mapped" />
                        <div style={s.statDivider} />
                        <Stat value="<50ms" label="Fault Detection" />
                        <div style={s.statDivider} />
                        <Stat value="99.9%" label="Grid Coverage" />
                    </div>
                </div>
            </section>

            {/* ─── FEATURES SECTION ─── */}
            <section style={s.featuresSection}>
                <div style={s.sectionHeader}>
                    <span style={s.sectionTag}>CAPABILITIES</span>
                    <h2 style={s.sectionTitle}>Everything you need for grid intelligence</h2>
                    <p style={s.sectionDesc}>
                        From real-time visualization to predictive sensor placement,
                        our platform covers every aspect of modern grid management.
                    </p>
                </div>

                <div style={s.featureGrid}>
                    <FeatureCard
                        icon={<Sparkles size={22} />}
                        iconColor="#1A56DB"
                        iconBg="rgba(26,86,219,0.08)"
                        title="Real-time Visualization"
                        desc="Render complex transmission networks with immersive high-fidelity maps, voltage-based color coding, and real-time state overlays."
                        delay={0}
                        mounted={mounted}
                        onClick={() => handleNav('/dashboard')}
                        linkText="Open Dashboard"
                    />
                    <FeatureCard
                        icon={<Cpu size={22} />}
                        iconColor="#7C3AED"
                        iconBg="rgba(124,58,237,0.08)"
                        title="Simulation Core"
                        desc="Recursive DFS-based sensor placement and BFS power flow propagation ensuring optimal coverage and grid reliability."
                        delay={0.08}
                        mounted={mounted}
                        onClick={() => handleNav('/simulation')}
                        linkText="Launch Simulation"
                    />
                    <FeatureCard
                        icon={<Activity size={22} />}
                        iconColor="#DC2626"
                        iconBg="rgba(220,38,38,0.08)"
                        title="Fault Analysis"
                        desc="Instantaneous detection and isolation of grid faults with cascading impact analysis and bridge fault detection."
                        delay={0.16}
                        mounted={mounted}
                        onClick={() => handleNav('/simulation')}
                        linkText="Test Fault Detection"
                    />
                    <FeatureCard
                        icon={<BarChart3 size={22} />}
                        iconColor="#0E9F6E"
                        iconBg="rgba(14,159,110,0.08)"
                        title="Sensor Predictor"
                        desc="Estimate optimal sensor counts for any grid region using recursive DFS rules — feeder exit, interval, and dead-end placement."
                        delay={0.24}
                        mounted={mounted}
                        onClick={() => handleNav('/sensor-predictor')}
                        linkText="Open Predictor"
                    />
                    <FeatureCard
                        icon={<MapPin size={22} />}
                        iconColor="#D97706"
                        iconBg="rgba(217,119,6,0.08)"
                        title="Infrastructure Planner"
                        desc="Define grid topology by drawing on the map, importing GeoJSON/CSV, or clipping from the database — sensors are placed automatically."
                        delay={0.32}
                        mounted={mounted}
                        onClick={() => handleNav('/infrastructure-planner')}
                        linkText="Open Planner"
                    />
                </div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section style={s.howSection}>
                <div style={s.sectionHeader}>
                    <span style={s.sectionTag}>WORKFLOW</span>
                    <h2 style={s.sectionTitle}>Three steps to grid intelligence</h2>
                </div>
                <div style={s.stepsGrid}>
                    <Step number="01" title="Load & Visualize" desc="Select a geographic region and instantly load the complete grid topology with buses, lines, substations, and infrastructure." />
                    <Step number="02" title="Simulate & Analyze" desc="Energize the grid, deploy sensors via recursive DFS traversal, and inject faults to study cascading impacts in real time." />
                    <Step number="03" title="Predict & Optimize" desc="Use the sensor predictor to estimate optimal sensor density with coverage verification and sensitivity analysis." />
                </div>
            </section>

            {/* ─── CTA BANNER ─── */}
            <section style={s.ctaBanner}>
                <h2 style={s.ctaBannerTitle}>Ready to explore your grid?</h2>
                <p style={s.ctaBannerDesc}>
                    Start with the simulation or predict sensor counts for your network.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => handleNav('/simulation')} style={s.primaryBtn}>
                        Launch Simulation <ArrowRight size={16} />
                    </button>
                    <button onClick={() => handleNav('/sensor-predictor')} style={{ ...s.secondaryBtn, background: 'rgba(26,86,219,0.06)' }}>
                        Sensor Predictor
                    </button>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer style={s.footer}>
                <div style={s.footerInner}>
                    <div style={s.footerLeft}>
                        <img src={logo} alt="Apparent Energy" style={{ height: 28, borderRadius: 6 }} />
                        <span style={s.footerBrand}>Apparent Energy</span>
                    </div>
                    <span style={s.footerCopy}>&copy; 2026 Apparent Energy. All rights reserved.</span>
                    <div style={s.statusPill}>
                        <span style={s.statusDot} />
                        Systems Operational
                    </div>
                </div>
            </footer>
        </div>
    );
};

/* ── Stat Chip ── */
const Stat = ({ value, label }) => (
    <div style={s.stat}>
        <span style={s.statValue}>{value}</span>
        <span style={s.statLabel}>{label}</span>
    </div>
);

/* ── Feature Card ── */
const FeatureCard = ({ icon, iconColor, iconBg, title, desc, delay, mounted, onClick, linkText }) => (
    <div
        className="landing-feature-card"
        style={{
            ...s.featureCard,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(28px)',
            transitionDelay: `${delay}s`,
        }}
        onClick={onClick}
    >
        <div style={{ ...s.featureIcon, background: iconBg, color: iconColor }}>{icon}</div>
        <h3 style={s.featureTitle}>{title}</h3>
        <p style={s.featureDesc}>{desc}</p>
        <span style={{ ...s.featureLink, color: iconColor }}>
            {linkText} <ChevronRight size={14} style={{ transition: 'transform 0.2s' }} />
        </span>
    </div>
);

/* ── Step Card ── */
const Step = ({ number, title, desc }) => (
    <div className="landing-step-card" style={s.stepCard}>
        <span style={s.stepNumber}>{number}</span>
        <h3 style={s.stepTitle}>{title}</h3>
        <p style={s.stepDesc}>{desc}</p>
    </div>
);

/* ═══════════════════════════════════════════
   KEYFRAME ANIMATIONS
   ═══════════════════════════════════════════ */
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  .landing-feature-card {
    cursor: pointer;
    transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
                box-shadow 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
                border-color 0.32s ease !important;
  }
  .landing-feature-card:hover {
    transform: translateY(-6px) !important;
    box-shadow: 0 20px 48px -12px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04) !important;
    border-color: rgba(26,86,219,0.18) !important;
  }
  .landing-feature-card:hover span:last-child svg {
    transform: translateX(4px);
  }

  .landing-step-card {
    transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
                box-shadow 0.32s ease !important;
  }
  .landing-step-card:hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 32px -8px rgba(0,0,0,0.08) !important;
  }

  @keyframes float-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(14,159,110,0.5); }
    50% { opacity: 0.6; box-shadow: 0 0 12px rgba(14,159,110,0.7); }
  }

  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Smooth button hover */
  button { transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) !important; }
`;

/* ═══════════════════════════════════════════
   STYLES — Light Premium Theme
   ═══════════════════════════════════════════ */
const s = {
    page: {
        background: '#FAFBFD',
        color: '#0F172A',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        overflowX: 'hidden',
        WebkitFontSmoothing: 'antialiased',
    },

    /* ── Navigation ── */
    nav: {
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        padding: '0 40px',
    },
    navInner: {
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 72,
    },
    logoContainer: {
        display: 'flex', alignItems: 'center', gap: 10,
    },
    logo: {
        height: 32, borderRadius: 8,
    },
    logoText: {
        fontWeight: 800, fontSize: 15, letterSpacing: '0.02em',
        color: '#0F172A',
    },
    navLinks: {
        display: 'flex', alignItems: 'center', gap: 32,
    },
    navLink: {
        background: 'none', border: 'none',
        color: '#64748B', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', padding: 0,
        fontFamily: 'inherit',
    },
    navCta: {
        display: 'inline-flex', alignItems: 'center',
        background: '#0F172A', color: '#fff',
        border: 'none', borderRadius: 8,
        padding: '9px 18px', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    },

    /* ── Hero ── */
    hero: {
        position: 'relative',
        paddingTop: 160, paddingBottom: 100,
        textAlign: 'center',
        maxWidth: 1280, margin: '0 auto',
        overflow: 'hidden',
    },
    orb: {
        position: 'absolute', width: '60vw', height: '60vw',
        borderRadius: '50%', pointerEvents: 'none',
        transition: 'transform 0.1s linear',
    },
    heroContent: {
        position: 'relative', zIndex: 2,
        padding: '0 24px',
    },
    badge: {
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(14,159,110,0.06)', border: '1px solid rgba(14,159,110,0.15)',
        borderRadius: 100, padding: '6px 16px 6px 10px',
        fontSize: 12, fontWeight: 600, color: '#0E9F6E',
        marginBottom: 32,
        transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s',
    },
    badgeDot: {
        width: 7, height: 7, borderRadius: '50%',
        background: '#0E9F6E',
        animation: 'float-dot 2s ease-in-out infinite',
    },
    title: {
        fontSize: 72, fontWeight: 800, lineHeight: 1.05,
        letterSpacing: '-0.035em',
        color: '#0F172A',
        margin: '0 auto 24px',
        maxWidth: 720,
        transition: 'all 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.15s',
    },
    titleAccent: {
        background: 'linear-gradient(135deg, #1A56DB 0%, #0E9F6E 100%)',
        backgroundSize: '200% 200%',
        animation: 'gradient-shift 6s ease infinite',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        fontSize: 18, lineHeight: 1.7, fontWeight: 400,
        color: '#64748B',
        maxWidth: 580, margin: '0 auto 40px',
        transition: 'all 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.25s',
    },
    ctaGroup: {
        display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
        marginBottom: 56,
        transition: 'all 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.35s',
    },
    primaryBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '14px 28px',
        background: '#1A56DB', color: '#fff',
        border: 'none', borderRadius: 10,
        fontSize: 15, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 4px 14px rgba(26,86,219,0.25), 0 1px 3px rgba(26,86,219,0.15)',
    },
    secondaryBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '14px 28px',
        background: '#fff', color: '#0F172A',
        border: '1px solid #E2E8F0', borderRadius: 10,
        fontSize: 15, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    },
    statsRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0, flexWrap: 'wrap',
        transition: 'all 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.45s',
    },
    stat: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 28px',
    },
    statValue: {
        fontSize: 28, fontWeight: 700, color: '#0F172A',
        letterSpacing: '-0.02em',
    },
    statLabel: {
        fontSize: 12, fontWeight: 500, color: '#94A3B8',
        marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em',
    },
    statDivider: {
        width: 1, height: 32, background: '#E2E8F0',
    },

    /* ── Features ── */
    featuresSection: {
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 40px 100px',
    },
    sectionHeader: {
        textAlign: 'center', marginBottom: 56,
    },
    sectionTag: {
        display: 'inline-block',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: '#1A56DB', textTransform: 'uppercase',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 36, fontWeight: 700, color: '#0F172A',
        letterSpacing: '-0.025em', margin: '0 0 12px',
    },
    sectionDesc: {
        fontSize: 16, color: '#64748B', fontWeight: 400,
        maxWidth: 560, margin: '0 auto', lineHeight: 1.6,
    },
    featureGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
    },
    featureCard: {
        padding: '28px 24px',
        background: '#FFFFFF',
        border: '1px solid #E8ECF2',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    featureIcon: {
        width: 44, height: 44, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    featureTitle: {
        fontSize: 17, fontWeight: 650, color: '#0F172A',
        margin: 0, letterSpacing: '-0.01em',
    },
    featureDesc: {
        fontSize: 14, lineHeight: 1.6, color: '#64748B',
        margin: 0, flex: 1,
    },
    featureLink: {
        fontSize: 13, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 2,
        marginTop: 4,
    },

    /* ── How it Works ── */
    howSection: {
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 40px 100px',
        borderTop: '1px solid #F1F5F9',
    },
    stepsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
    },
    stepCard: {
        padding: '28px 24px',
        background: '#FFFFFF',
        border: '1px solid #E8ECF2',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    stepNumber: {
        display: 'inline-block',
        fontSize: 12, fontWeight: 700, color: '#1A56DB',
        background: 'rgba(26,86,219,0.06)',
        borderRadius: 6, padding: '4px 10px',
        marginBottom: 16, fontFamily: '"JetBrains Mono", monospace',
    },
    stepTitle: {
        fontSize: 17, fontWeight: 650, color: '#0F172A',
        margin: '0 0 8px', letterSpacing: '-0.01em',
    },
    stepDesc: {
        fontSize: 14, lineHeight: 1.6, color: '#64748B', margin: 0,
    },

    /* ── CTA Banner ── */
    ctaBanner: {
        textAlign: 'center',
        padding: '72px 40px',
        margin: '0 40px 60px',
        background: 'linear-gradient(135deg, #F8FAFF 0%, #F0F7F4 100%)',
        borderRadius: 20,
        border: '1px solid #E2E8F0',
    },
    ctaBannerTitle: {
        fontSize: 30, fontWeight: 700, color: '#0F172A',
        margin: '0 0 8px', letterSpacing: '-0.02em',
    },
    ctaBannerDesc: {
        fontSize: 16, color: '#64748B', margin: '0 0 32px',
    },

    /* ── Footer ── */
    footer: {
        borderTop: '1px solid #F1F5F9',
        padding: '0 40px',
    },
    footerInner: {
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '24px 0',
        flexWrap: 'wrap', gap: 16,
    },
    footerLeft: {
        display: 'flex', alignItems: 'center', gap: 10,
    },
    footerBrand: {
        fontSize: 14, fontWeight: 600, color: '#334155',
    },
    footerCopy: {
        fontSize: 13, color: '#94A3B8',
    },
    statusPill: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 500, color: '#0E9F6E',
        background: 'rgba(14,159,110,0.06)',
        border: '1px solid rgba(14,159,110,0.15)',
        borderRadius: 100, padding: '5px 14px 5px 10px',
    },
    statusDot: {
        width: 6, height: 6, borderRadius: '50%',
        background: '#0E9F6E',
        animation: 'float-dot 2s ease-in-out infinite',
    },
};

export default LandingPage;
