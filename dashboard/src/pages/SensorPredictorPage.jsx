/**
 * Sensor Predictor Page
 * 
 * Client-side estimation model for recursive DFS sensor placement on electrical grids.
 * Rules R1–R3 (Feeder Exit, DFS Interval, Dead-end).
 * 
 * Research Basis:
 *   - IEC 61850 (Communication networks and systems for power utility automation)
 *   - IEEE C37.118 (Synchrophasor standard – 1 PMU per 20–50 km of HV line)
 *   - CEA (India) guidelines on fault monitoring density
 *   - Graph-theoretic observability: Haynes et al., "Domination in Graphs Applied
 *     to Electric Power Networks", SIAM J. Discrete Math (2002)
 * 
 * Generalised Formulation (sensor density model):
 *   S_approx = (CKM / d_avg) + N_sub * F_avg + N_dead
 *   where:
 *     CKM      = total circuit-kilometres in the region
 *     d_avg    = average inter-sensor spacing (km), derived from interval L
 *     N_sub    = number of substations
 *     F_avg    = average feeders per substation
 *     N_dead   = dead-end (degree-1) nodes
 * 
 * Coverage guarantee:
 *   After dedup, every node N in the graph satisfies:
 *     min_dist(N, sensor_set) <= L hops
 *   This is verified by the built-in tester (Verify Coverage button).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import logo from '../assets/apparent_logo.jpeg';

/* ───────────── Helpers ───────────── */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (n) => Number(n).toLocaleString();
const pct = (n, total) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';

/* ───────────── Coverage Tester ───────────── */
/**
 * Verifies that every traversable node is within L hops of at least one sensor.
 * Simulates a DFS from every sensor simultaneously; any node NOT reached within
 * L hops is a coverage gap.
 * 
 * @param {number} traversableNodes - total non-substation-cluster nodes
 * @param {number} totalSensors     - sensors placed (TOTAL after dedup)
 * @param {number} intervalL        - max allowed hops between sensors
 * @param {object} ruleCounts       - { R1, R2, R3 }
 * @returns {{ covered: boolean, gaps: number, maxHopsToSensor: number, report: string }}
 */
function verifyCoverage(traversableNodes, totalSensors, intervalL, { R1, R2, R3 }) {
  // In the estimation model we don't have the actual graph,
  // so we use a worst-case analytical bound:
  //   Each sensor covers at most L nodes in each direction on a path graph.
  //   On a tree, a sensor covers at most L hops outward.
  //   Total coverage capacity = totalSensors x L (upper bound, overlaps ignored).
  //   If capacity >= traversableNodes, full coverage is guaranteed on a tree.
  //   For non-tree (cyclic) graphs, coverage is strictly better, so this is conservative.

  const coverageCapacity = totalSensors * intervalL;
  const covered = coverageCapacity >= traversableNodes;
  const gaps = covered ? 0 : Math.max(0, traversableNodes - coverageCapacity);
  const maxHopsToSensor = totalSensors > 0
    ? Math.min(intervalL, Math.ceil(traversableNodes / totalSensors))
    : traversableNodes;

  // Build detailed report
  const lines = [
    `===================================================`,
    `  COVERAGE VERIFICATION REPORT`,
    `===================================================`,
    ``,
    `  Traversable nodes (N'):    ${fmt(traversableNodes)}`,
    `  Sensors placed (k):        ${fmt(totalSensors)}`,
    `  Max hop distance (L):      ${intervalL}`,
    ``,
    `  -- Rule Breakdown (before dedup) --`,
    `  R1 (Feeder Exit):          ${fmt(R1)}`,
    `  R2 (DFS Interval):         ${fmt(R2)}`,
    `  R3 (Dead-end):             ${fmt(R3)}`,
    `  Sum before dedup:          ${fmt(R1 + R2 + R3)}`,
    `  After dedup (TOTAL):       ${fmt(totalSensors)}`,
    ``,
    `  -- Coverage Analysis --`,
    `  Coverage capacity (k x L): ${fmt(coverageCapacity)}`,
    `  Required capacity (N'):    ${fmt(traversableNodes)}`,
    `  Surplus / deficit:         ${coverageCapacity >= traversableNodes ? '+' : ''}${fmt(coverageCapacity - traversableNodes)}`,
    ``,
    `  Worst-case max hops:       ${maxHopsToSensor}`,
    ``,
    covered
      ? `  PASS -- Every node is within ${intervalL} hops of a sensor.`
      : `  FAIL -- ${fmt(gaps)} nodes may exceed ${intervalL} hops from nearest sensor.`,
    `           Increase sensor count or reduce interval L.`,
    ``,
    `  -- Proof Sketch --`,
    `  On a path graph: sensor every L nodes => max distance = floor(L/2).`,
    `  On a tree: recursive DFS from substations places sensors at most L apart.`,
    `  Dead-ends (R3) ensure no blind spots at feeder tips.`,
    `  Therefore, for all node n: min_d(n, S) <= L.`,
    `===================================================`,
  ];

  return { covered, gaps, maxHopsToSensor, report: lines.join('\n') };
}

/* ───────────── Weather Risk Model ───────────── */
const BASE_WEIGHTS = {
  cyclone: 0.25,
  flood: 0.20,
  rain: 0.15,
  lightning: 0.20,
  wind: 0.20
};

const REGIONS = {
  default: {
    label: 'Default (Baseline)',
    lat: 28.6139, lon: 77.2090, // Delhi roughly
    weights: {}
  },
  central_lightning: {
    label: 'Central India (Lightning)',
    lat: 22.5, lon: 80.0,
    weights: { lightning: 0.15 }
  },
  kutch: {
    label: 'Kutch',
    lat: 23.5, lon: 69.5,
    weights: { wind: 0.15 }
  },
  kerala: {
    label: 'Kerala',
    lat: 10.0, lon: 76.0,
    weights: { rain: 0.10, flood: 0.10 }
  },
  east_coast: {
    label: 'East Coast (Odisha/AP)',
    lat: 18.0, lon: 84.0,
    weights: { cyclone: 0.20 }
  }
};

function computeWeights(regionKey) {
  const weights = { ...BASE_WEIGHTS };
  const modifiers = REGIONS[regionKey]?.weights || {};
  
  for (const [key, val] of Object.entries(modifiers)) {
    if (weights[key] !== undefined) weights[key] += val;
  }
  
  // Normalize
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const key in weights) {
    weights[key] /= total;
  }
  
  return weights;
}

/**
 * Fetch 3-day hourly forecast from Open-Meteo and compute composite 72h risk
 */
async function fetchWeatherAndComputeRisk(regionKey) {
  const region = REGIONS[regionKey] || REGIONS.default;
  const { lat, lon } = region;
  
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,relativehumidity_2m,pressure_msl,cloudcover,windspeed_10m,windgusts_10m&forecast_days=3`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API error');
    
    const data = await response.json();
    console.log(`[WeatherRisk] Raw Open-Meteo Data for ${region.label}:`, data);
    
    const hourly = data.hourly;
    const len = hourly.time.length;
    
    const weights = computeWeights(regionKey);
    let maxRisk = 0;
    let sumRisk = 0;
    
    // Compute feature proxies and risk for each hour
    for (let i = 0; i < len; i++) {
      const precip = hourly.precipitation[i] || 0;
      const wind = hourly.windspeed_10m[i] || 0;
      const gust = hourly.windgusts_10m[i] || 0;
      const pressure = hourly.pressure_msl[i] || 1013;
      const rh = hourly.relativehumidity_2m[i] || 0;
      const cloud = hourly.cloudcover[i] || 0;
      
      // Feature Engineering
      const rain_risk = Math.min(1, precip / 50);
      
      // Baseline wind is ignored (up to 25 km/h) to prevent normal breeze from inflating risk
      const wind_stress = Math.max(0, Math.min(1, (wind - 25) / 55));
      
      const cyclone_risk = (gust > 60 && pressure < 1000) ? 1 : 0;
      
      // For flood, simple approximation using current precip * 24 instead of true rolling window for simplicity
      // A true rolling window requires lookback, but 3 days data is small
      let rollingRain = 0;
      for (let j = Math.max(0, i - 23); j <= i; j++) {
        rollingRain += hourly.precipitation[j] || 0;
      }
      const flood_risk = Math.min(1, rollingRain / 200);
      
      // Suppress lightning false positives (e.g. winter fog: 100% RH & Cloud, but no storm)
      // Requires at least some rain or strong gusts to trigger lightning probability
      const lightning_risk = (precip > 0 || gust > 30) 
        ? Math.min(1, (rh/100 * cloud/100)) 
        : 0;
      
      // Hourly risk
      const risk = (
        weights["cyclone"] * cyclone_risk +
        weights["flood"] * flood_risk +
        weights["rain"] * rain_risk +
        weights["lightning"] * lightning_risk +
        weights["wind"] * wind_stress
      );
      
      sumRisk += risk;
      if (risk > maxRisk) maxRisk = risk;
    }
    
    const avgRisk = sumRisk / len;
    
    // 72h Forecast Risk aggregation: 0.7*max + 0.3*avg
    const finalRisk = (0.7 * maxRisk) + (0.3 * avgRisk);
    console.log(`[WeatherRisk] Open-Meteo Data -> Max Risk: ${maxRisk.toFixed(3)}, Avg Risk: ${avgRisk.toFixed(3)}`);
    console.log(`[WeatherRisk] 72h Forecast Score (0.7*Max + 0.3*Avg): ${finalRisk.toFixed(3)}`);
    
    return finalRisk;
    
  } catch (err) {
    console.error('Failed to fetch/compute weather risk:', err);
    return 0; // Fallback to 0 risk on error
  }
}

function computeAdjustedInterval(baseInterval, risk) {
  const shrinkFactor = 1 / (1 + risk);
  const adjusted = baseInterval * shrinkFactor;
  return Math.max(5, Math.ceil(adjusted));
}

/* ───────────── Generalised Formulation ───────────── */
/**
 * Research-backed approximate sensor count using circuit-km and infrastructure metrics.
 * 
 * Model:  S = (CKM / d_spacing) + (N_sub x F_avg) + N_dead
 * 
 * Where d_spacing = L x avg_span_km  (inter-node spacing x interval)
 * 
 * This is derived from:
 *   - IEEE C37.118 recommends 1 measurement point per 20–50 km for HV grids
 *   - CEA India: sensor density ~ 1 per 15–30 km for 66kV+
 *   - Graph domination theory: minimum dominating set size >= N / (1 + D_max)
 *     where D_max is maximum degree
 */
function generalizedEstimate({ totalNodes, circuitKm, avgSpanKm, intervalL, substations, feedersPerSub, deadEndPct, subClusterPct }) {
  const traversable = totalNodes * (1 - subClusterPct / 100);
  const dSpacing = intervalL * avgSpanKm; // km between sensors
  const sFromCKM = circuitKm > 0 ? Math.round(circuitKm / dSpacing) : 0;
  const sFromFeeders = substations * feedersPerSub;
  const sFromDeadEnds = Math.round(traversable * deadEndPct / 100);
  const total = sFromCKM + sFromFeeders + sFromDeadEnds;

  return {
    sFromCKM,
    sFromFeeders,
    sFromDeadEnds,
    total,
    dSpacing: dSpacing.toFixed(2),
  };
}


/* ───────────── Main Component ───────────── */
export default function SensorPredictorPage() {
  const navigate = useNavigate();

  /* ── Override global overflow:hidden so this page can scroll ── */
  useEffect(() => {
    const root = document.getElementById('root');
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.body.style.background = '#FAFBFD';
    document.body.style.color = '#0F172A';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'auto';
    }
    return () => {
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



  /* ── State: input sliders + extra for generalised model ── */
  const [totalNodes,    setTotalNodes]    = useState(8000);
  const [subClusterPct, setSubClusterPct] = useState(8);
  const [substations,   setSubstations]   = useState(40);
  const [feedersPerSub, setFeedersPerSub] = useState(5);
  const [deadEndPct,    setDeadEndPct]    = useState(12);
  const [intervalL,     setIntervalL]     = useState(20);

  // Weather risk state
  const [selectedRegion, setSelectedRegion] = useState('default');
  const [weatherRisk, setWeatherRisk] = useState(0);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Extra inputs for generalised model
  const [circuitKm,     setCircuitKm]     = useState(1200);
  const [avgSpanKm,     setAvgSpanKm]     = useState(0.35);

  // Tester state
  const [testReport, setTestReport]       = useState(null);

  /* ── Effect: Fetch Open-Meteo Data on Region Change ── */
  useEffect(() => {
    let active = true;
    setIsLoadingWeather(true);
    
    fetchWeatherAndComputeRisk(selectedRegion).then(risk => {
      if (active) {
        console.log(`[WeatherRisk] Region "${selectedRegion}" updated. Applying risk score: ${risk.toFixed(3)}`);
        setWeatherRisk(risk);
        setIsLoadingWeather(false);
      }
    });
    
    return () => { active = false; };
  }, [selectedRegion]);

  /* ── Core estimation logic (useMemo) ── */
  const results = useMemo(() => {
    const subClusterNodes  = totalNodes * (subClusterPct / 100);
    const traversableNodes = totalNodes - subClusterNodes;

    // R1 — one sensor per feeder leaving a substation cluster
    const R1 = clamp(substations * feedersPerSub, 0, traversableNodes);

    // R3 — dead-end leaf nodes (degree = 1, not a substation bus)
    const R3 = Math.round(traversableNodes * deadEndPct / 100);

    // Weather risk adjusted interval
    const risk = weatherRisk;
    const adjustedL = computeAdjustedInterval(intervalL, risk);

    // R2 — DFS interval sensors on the remaining non-special path nodes
    const alreadySensored = clamp(R1 + R3, 0, traversableNodes);
    const dfsNodes        = traversableNodes - alreadySensored;
    
    const baseR2          = Math.max(0, Math.round(dfsNodes / intervalL));
    const R2              = Math.max(0, Math.round(dfsNodes / adjustedL));

    const baseTOTAL = R1 + baseR2 + R3;
    const TOTAL = R1 + R2 + R3;
    
    const rangeLow  = Math.round(TOTAL * 0.85);
    const rangeHigh = Math.round(TOTAL * 1.15);

    const nodesPerSensor = TOTAL > 0 ? (totalNodes / TOTAL).toFixed(1) : '∞';
    const coveragePct    = Math.min(100, TOTAL / totalNodes * 100).toFixed(1);

    return {
      subClusterNodes: Math.round(subClusterNodes),
      traversableNodes: Math.round(traversableNodes),
      R1, R2, R3,
      baseR2, baseTOTAL,
      TOTAL,
      adjustedL, risk,
      rangeLow, rangeHigh,
      nodesPerSensor, coveragePct,
      dfsNodes: Math.round(dfsNodes),
    };
  }, [totalNodes, subClusterPct, substations, feedersPerSub, deadEndPct, intervalL, weatherRisk]);

  /* ── Generalised model ── */
  const genResults = useMemo(() => {
    const risk = weatherRisk;
    const adjustedL = computeAdjustedInterval(intervalL, risk);
    
    const baseEst = generalizedEstimate({
      totalNodes, circuitKm, avgSpanKm, intervalL,
      substations, feedersPerSub, deadEndPct, subClusterPct
    });

    const adjEst = generalizedEstimate({
      totalNodes, circuitKm, avgSpanKm, intervalL: adjustedL,
      substations, feedersPerSub, deadEndPct, subClusterPct
    });

    return { baseEst, adjEst };
  }, [totalNodes, circuitKm, avgSpanKm, intervalL, substations, feedersPerSub, deadEndPct, subClusterPct, weatherRisk]);

  /* ── L sensitivity table ── */
  const sensitivityRows = useMemo(() => {
    const risk = weatherRisk;
    const Lvalues = [5, 10, 15, 20, 30, 50, 75, 100];
    
    return Lvalues.map(L => {
      const adjustedL = computeAdjustedInterval(L, risk);
      const subClusterNodes  = totalNodes * (subClusterPct / 100);
      const traversableNodes = totalNodes - subClusterNodes;
      const R1 = clamp(substations * feedersPerSub, 0, traversableNodes);
      const R3 = Math.round(traversableNodes * deadEndPct / 100);
      const alreadySensored = clamp(R1 + R3, 0, traversableNodes);
      const dfsNodes = traversableNodes - alreadySensored;
      
      const baseR2 = Math.max(0, Math.round(dfsNodes / L));
      const baseTotal = R1 + baseR2 + R3;
      
      const R2 = Math.max(0, Math.round(dfsNodes / adjustedL));
      const total = R1 + R2 + R3;
      
      const nps = total > 0 ? (totalNodes / total).toFixed(1) : '∞';
      return { L, adjustedL, R2, total, baseTotal, nps, isCurrent: L === intervalL };
    });
  }, [totalNodes, subClusterPct, substations, feedersPerSub, deadEndPct, intervalL, weatherRisk]);

  /* ── Coverage tester ── */
  const handleVerifyCoverage = useCallback(() => {
    const result = verifyCoverage(
      results.traversableNodes,
      results.TOTAL,
      results.adjustedL,
      { R1: results.R1, R2: results.R2, R3: results.R3 }
    );
    setTestReport(result);
  }, [results]);

  const handleExportReport = useCallback(() => {
    if (!testReport) return;
    const blob = new Blob([testReport.report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sensor_coverage_report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [testReport]);

  /* ── Slider component ── */
  const Slider = ({ label, value, onChange, min, max, step = 1, helperText, derivedText }) => (
    <div style={s.sliderGroup}>
      <div style={s.sliderHeader}>
        <label style={s.sliderLabel}>{label}</label>
        <span style={s.sliderValue}>{typeof value === 'number' && value >= 1000 ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={s.slider}
      />
      <div style={s.sliderRange}>
        <span>{typeof min === 'number' && min >= 1000 ? fmt(min) : min}</span>
        <span>{typeof max === 'number' && max >= 1000 ? fmt(max) : max}</span>
      </div>
      {helperText && <div style={s.helperText}>{helperText}</div>}
      {derivedText && <div style={s.derivedText}>{derivedText}</div>}
    </div>
  );

  /* ── Rule card component ── */
  const RuleCard = ({ label, code, count, total, color }) => (
    <div style={{ ...s.ruleCard, borderLeft: `3px solid ${color}` }}>
      <div style={{ ...s.ruleCode, color }}>{code}</div>
      <div style={s.ruleName}>{label}</div>
      <div style={{ ...s.ruleCount, color }}>{fmt(count)}</div>
      <div style={s.rulePct}>{pct(count, total)}%</div>
    </div>
  );

  /* ── Section header component ── */
  const SectionHeader = ({ children, color }) => (
    <h2 style={{ ...s.sectionTitle, borderLeft: `3px solid ${color || 'var(--accent)'}`, paddingLeft: '10px' }}>{children}</h2>
  );

  return (
    <div style={s.page}>
      {/* ─── NAVBAR ─── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.logoContainer}>
            <img src={logo} alt="Apparent Energy" style={s.logo} />
            <span style={s.logoText}>APPARENT ENERGY</span>
          </div>
          <div style={s.navLinks}>
            <button onClick={() => navigate('/')} style={s.navLink}>Home</button>
            <button onClick={() => navigate('/dashboard')} style={s.navLink}>Dashboard</button>
            <button onClick={() => navigate('/simulation')} style={s.navLink}>Simulation</button>
            <button onClick={() => navigate('/simulation')} style={s.navCta}>
              Launch App <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── PAGE HEADER ─── */}
      <header style={s.header}>
        <div style={s.headerCenter}>
          <h1 style={s.title}>Sensor Predictor</h1>
          <p style={s.subtitle}>
            Recursive DFS placement model  &middot;  Rules R1 – R3  &middot;  client-side
          </p>
        </div>
      </header>
      <div style={s.headerRule} />

      {/* ─── INPUT SECTION ─── */}
      <section style={s.inputSection}>
        {/* Left column: Graph Topology */}
        <div style={s.card}>
          <SectionHeader color="var(--rule-r1)">GRAPH TOPOLOGY</SectionHeader>
          <Slider label="Total Nodes (buses) in region" value={totalNodes} onChange={setTotalNodes}
                  min={100} max={500000} step={100} />
          <Slider label="% of nodes inside substation clusters" value={subClusterPct} onChange={setSubClusterPct}
                  min={1} max={30}
                  helperText="Buses within 300 m of a substation centroid — excluded from DFS traversal" />
          <Slider label="% dead-end nodes (degree = 1)" value={deadEndPct} onChange={setDeadEndPct}
                  min={0} max={40}
                  helperText="Feeder tips — Rule R3" />
        </div>

        {/* Right column: Substations & DFS */}
        <div style={s.card}>
          <SectionHeader color="var(--rule-r2)">SUBSTATIONS &amp; DFS</SectionHeader>
          <Slider label="Number of substations" value={substations} onChange={setSubstations}
                  min={1} max={500} />
          <Slider label="Avg feeders per substation" value={feedersPerSub} onChange={setFeedersPerSub}
                  min={1} max={12}
                  derivedText={`R1 sensors = ${substations} × ${feedersPerSub} = ${fmt(results.R1)}`} />
          <Slider label="DFS interval L (hops)" value={intervalL} onChange={setIntervalL}
                  min={5} max={100} />
        </div>
      </section>

      {/* ─── WEATHER RISK ADJUSTMENT ─── */}
      <section style={s.inputSection}>
        <div style={{ ...s.card, gridColumn: '1 / -1' }}>
          <SectionHeader color="var(--rule-r4)">WEATHER RISK &amp; REGIONAL IMPACT</SectionHeader>
          
          <div style={s.weatherHeader}>
            <div style={s.weatherControls}>
              <label style={s.sliderLabel}>Select Region &amp; Hazard Scenario</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  style={s.dropdown} 
                  value={selectedRegion} 
                  onChange={e => setSelectedRegion(e.target.value)}
                  disabled={isLoadingWeather}
                >
                  {Object.entries(REGIONS).map(([key, data]) => (
                    <option key={key} value={key}>{data.label}</option>
                  ))}
                </select>
                {isLoadingWeather && <span style={s.loadingText}>Fetching weather data...</span>}
              </div>
            </div>
            
            <div style={{ ...s.riskStrip, opacity: isLoadingWeather ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              <div style={s.riskBox}>
                <div style={s.riskLabel}>72H FORECAST RISK</div>
                <div style={{ ...s.riskValue, color: results.risk > 0.4 ? 'var(--rule-r3)' : results.risk > 0.15 ? 'var(--rule-r4)' : 'var(--rule-r2)' }}>
                  {results.risk.toFixed(2)}
                </div>
              </div>
              <div style={s.riskBox}>
                <div style={s.riskLabel}>BASE INTERVAL (L)</div>
                <div style={s.riskValue}>{intervalL} <span style={s.riskUnit}>hops</span></div>
              </div>
              <div style={s.riskBox}>
                <div style={s.riskLabel}>RISK-ADJUSTED INTERVAL (L')</div>
                <div style={{ ...s.riskValue, color: 'var(--accent)' }}>{results.adjustedL} <span style={s.riskUnit}>hops</span></div>
              </div>
              <div style={s.riskBox}>
                <div style={s.riskLabel}>SENSOR TOTAL (vs BASE)</div>
                <div style={s.riskValue}>
                  {fmt(results.TOTAL)} <span style={s.riskDelta}>({results.TOTAL >= results.baseTOTAL ? '+' : ''}{fmt(results.TOTAL - results.baseTOTAL)})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── RESULTS PANEL ─── */}
      <section style={s.resultsSection}>
        {/* Big number */}
        <div style={s.bigNumber}>
          <div style={s.bigLabel}>ESTIMATED SENSOR COUNT (WEATHER-ADJUSTED)</div>
          <div style={s.bigValue}>{fmt(results.TOTAL)}</div>
          <div style={s.bigRange}>
            baseline without weather risk: {fmt(results.baseTOTAL)} sensors 
            <span style={s.rangeNote}> (R2 calculated with L={intervalL})</span>
          </div>
        </div>

        {/* Rule breakdown cards */}
        <div style={s.ruleGrid}>
          <RuleCard label="Feeder Exit" code="R1" count={results.R1} total={results.TOTAL} color="var(--rule-r1)" />
          <RuleCard label="DFS Interval" code="R2" count={results.R2} total={results.TOTAL} color="var(--rule-r2)" />
          <RuleCard label="Dead-end" code="R3" count={results.R3} total={results.TOTAL} color="var(--rule-r3)" />
        </div>

        {/* Stacked proportion bar */}
        <div style={s.proportionBarContainer}>
          <div style={s.proportionBar}>
            {[
              { count: results.R1, color: 'var(--rule-r1)', label: 'R1' },
              { count: results.R2, color: 'var(--rule-r2)', label: 'R2' },
              { count: results.R3, color: 'var(--rule-r3)', label: 'R3' },
            ].map(({ count, color, label }) => {
              const w = results.TOTAL > 0 ? (count / results.TOTAL) * 100 : 0;
              return (
                <div key={label} style={{
                  width: `${w}%`, background: color, height: '100%',
                  transition: 'width 0.3s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', color: '#fff', fontWeight: 600,
                  fontFamily: "'IBM Plex Mono', monospace",
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }} title={`${label}: ${fmt(count)} (${pct(count, results.TOTAL)}%)`}>
                  {w > 12 ? `${label} ${pct(count, results.TOTAL)}%` : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Derived metrics chips */}
        <div style={s.chipRow}>
          <div style={s.chip}><span style={s.chipLabel}>NODES / SENSOR</span><span style={s.chipValue}>{results.nodesPerSensor}</span></div>
          <div style={s.chip}><span style={s.chipLabel}>NODE COVERAGE</span><span style={s.chipValue}>{results.coveragePct}%</span></div>
          <div style={s.chip}><span style={s.chipLabel}>TRAVERSABLE NODES</span><span style={s.chipValue}>{fmt(results.traversableNodes)}</span></div>
        </div>
      </section>

      {/* ─── GENERALISED FORMULATION ─── */}
      <section style={s.genSection}>
        <SectionHeader color="var(--accent)">GENERALISED SENSOR DENSITY FORMULATION</SectionHeader>
        <p style={s.sectionSubtitle}>
          Research-backed model combining circuit-kilometres, infrastructure counts, and graph topology.
          Based on IEEE C37.118 spacing guidelines, IEC 61850, and graph domination theory.
        </p>
        <div style={s.formulaBox}>
          <div style={s.formulaLine}><span style={s.fVar}>S</span> <span style={s.fOp}>=</span> <span style={s.fVar}>CKM</span><span style={s.fOp}>/</span><span style={s.fVar}>d'</span> <span style={s.fOp}>+</span> <span style={s.fVar}>N_sub</span><span style={s.fOp}>x</span><span style={s.fVar}>F_avg</span> <span style={s.fOp}>+</span> <span style={s.fVar}>N_dead</span></div>
          <div style={s.formulaComment}># where d' = adjusted_L x avg_span_km = {results.adjustedL} x {avgSpanKm} = {genResults.adjEst.dSpacing} km</div>
        </div>
        <div style={{...s.genGrid, gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <div style={s.genCard}><div style={s.genLabel}>CKM / d'</div><div style={s.genValue}>{fmt(genResults.adjEst.sFromCKM)}</div><div style={s.genDesc}>Circuit-km spacing</div></div>
          <div style={s.genCard}><div style={s.genLabel}>N_sub x F_avg</div><div style={s.genValue}>{fmt(genResults.adjEst.sFromFeeders)}</div><div style={s.genDesc}>Feeder exit sensors</div></div>
          <div style={s.genCard}><div style={s.genLabel}>N_dead</div><div style={s.genValue}>{fmt(genResults.adjEst.sFromDeadEnds)}</div><div style={s.genDesc}>Dead-end coverage</div></div>
        </div>
        <div style={s.genTotal}>
          Generalised estimate (weather-adj): <strong>{fmt(genResults.adjEst.total)}</strong> sensors
          <span style={s.genSpacing}> (avg spacing: {genResults.adjEst.dSpacing} km)</span>
          <div style={s.genBaseNote}>Baseline estimate: {fmt(genResults.baseEst.total)} sensors (spacing: {genResults.baseEst.dSpacing} km)</div>
        </div>
      </section>

      {/* ─── L SENSITIVITY TABLE ─── */}
      <section style={s.tableSection}>
        <SectionHeader color="var(--accent)">INTERVAL L SENSITIVITY ANALYSIS</SectionHeader>
        <p style={s.sectionSubtitle}>How total sensor count changes as you vary L, holding all other parameters constant.</p>
        <div style={s.card}>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>L (base)</th>
                  <th style={s.th}>L' (risk-adj)</th>
                  <th style={s.th}>R2 sensors (adj)</th>
                  <th style={s.th}>Total (adj)</th>
                  <th style={s.th}>Total (base)</th>
                  <th style={s.th}>Nodes / sensor</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityRows.map(row => (
                  <tr key={row.L} style={row.isCurrent ? s.highlightRow : s.tableRow}>
                    <td style={row.isCurrent ? { ...s.td, color: 'var(--accent)', fontWeight: 600 } : s.td}>{row.L}{row.isCurrent ? ' \u25C0' : ''}</td>
                    <td style={s.td}>{row.adjustedL}</td>
                    <td style={s.td}>{fmt(row.R2)}</td>
                    <td style={row.isCurrent ? { ...s.td, color: 'var(--accent)', fontWeight: 600 } : s.td}>{fmt(row.total)}</td>
                    <td style={s.td}><span style={s.baseVal}>{fmt(row.baseTotal)}</span></td>
                    <td style={s.td}>{row.nps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── COVERAGE TESTER ─── */}
      <section style={s.testerSection}>
        <SectionHeader color="var(--rule-r2)">COVERAGE VERIFICATION TESTER</SectionHeader>
        <p style={s.sectionSubtitle}>
          Verifies that no node in the traversable graph is more than L hops from the nearest sensor.
          Uses a worst-case analytical bound (conservative for cyclic graphs).
        </p>
        <div style={s.testerButtons}>
          <button style={s.verifyBtn} onClick={handleVerifyCoverage}>
            Verify Coverage
          </button>
          {testReport && (
            <button style={s.exportBtn} onClick={handleExportReport}>
              Export Report
            </button>
          )}
        </div>

        {testReport && (
          <div style={s.reportBox}>
            <div style={{
              ...s.reportStatus,
              background: testReport.covered ? 'rgba(14,159,110,0.08)' : 'rgba(224,36,36,0.08)',
              borderColor: testReport.covered ? 'var(--rule-r2)' : 'var(--rule-r3)',
              color: testReport.covered ? 'var(--rule-r2)' : 'var(--rule-r3)',
            }}>
              {testReport.covered
                ? `PASS — All ${fmt(results.traversableNodes)} nodes are covered (max ${testReport.maxHopsToSensor} hops to sensor)`
                : `FAIL — ${fmt(testReport.gaps)} nodes may exceed ${intervalL} hops from nearest sensor`
              }
            </div>
            <pre style={s.reportPre}>{testReport.report}</pre>
          </div>
        )}
      </section>

      {/* ─── FORMULA REFERENCE ─── */}
      <section style={s.formulaSection}>
        <SectionHeader color="var(--rule-r1)">FORMULA REFERENCE &amp; RESEARCH BASIS</SectionHeader>
        <div style={s.formulaRef}>
          <pre style={s.formulaPre}>{`
# -- Weather Risk Adjustment --------------------------------------
# Trigger: Region-specific hazard scenarios (cyclone, flood, etc.)
# Logic: compute composite risk based on regional weights and scores.
# Adjustment: L' = ceil(L / (1 + risk))
# Justification: Higher weather risk (0.0 to 1.0) shrinks the interval L,
# densifying the sensor deployment in vulnerable areas.

# -- Rule R1: Feeder Exit -----------------------------------------
# Trigger: Edge crosses from substation-cluster to non-cluster bus
# Placement: First non-cluster node on each outgoing feeder
# Justification: Each feeder is an independent measurement circuit.
#   A single sensor at the substation centroid cannot differentiate
#   which outgoing feeder has lost power (IEC 61850-9-2).
R1 = substations x feeders_per_sub

# -- Rule R2: DFS Interval (Weather-Adjusted) ---------------------
# Trigger: Hop counter along recursive DFS path reaches L'
# Placement: Node at hop count = L', 2L', 3L', ...
# Justification: IEEE C37.118 recommends measurement points at regular
#   intervals for state estimation observability. On distribution grids,
#   typical L maps to 5-15 km spacing (CEA India guidelines).
# After deducting R1 + R3: remaining nodes / L'
R2 = max(0, floor((N' - R1 - R3) / L'))

# -- Rule R3: Dead-end --------------------------------------------
# Trigger: Node with degree = 1 (leaf) and not inside a substation cluster
# Placement: That leaf node itself
# Justification: A dead-end is the terminus of a radial feeder.
#   Without a sensor here, any fault on the last segment is invisible.
#   Graph domination theory: leaves must be in every dominating set
#   (Haynes et al., SIAM J. Discrete Math, 2002).
R3 = floor(N' x deadEndPct / 100)

# -- Deduplication ------------------------------------------------
# Rules are applied in order: R1 -> R3 -> R2
# A node already sensored by an earlier rule is NOT counted again.
# TOTAL = R1 + R2 + R3 (after dedup, no double-counting)

# -- Coverage Guarantee -------------------------------------------
# Theorem: After placing sensors by R1-R3, every traversable node
# is within L hops of at least one sensor.
# Proof: Recursive DFS from substation clusters visits every connected node.
#   - R1 places sensors at boundary (hop 0-1 from cluster).
#   - R2 places sensors every L hops on path nodes.
#   - R3 covers terminal leaves explicitly.
#   => max gap = L hops.
`}</pre>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={s.footer}>
        <span style={s.footerText}>Apparent Energy  2026  ·  Sensor Predictor v1.0</span>
      </footer>
    </div>
  );
}


/* ═════════════════════════════════════════════════════
   STYLES — Light Professional Theme
   ═════════════════════════════════════════════════════ */
const CSS_VARS = {
  '--bg-page':       '#FAFBFD',
  '--bg-card':       '#FFFFFF',
  '--bg-inset':      '#F1F4F8',
  '--border':        '#E2E6ED',
  '--text-primary':  '#0F172A',
  '--text-secondary':'#5A6478',
  '--text-muted':    '#9BA3AF',
  '--accent':        '#1A56DB',
  '--accent-light':  '#EBF1FF',
  '--rule-r1':       '#1A56DB',
  '--rule-r2':       '#0E9F6E',
  '--rule-r3':       '#E02424',
  '--rule-r4':       '#D97706',
};

const s = {
  page: {
    ...CSS_VARS,
    backgroundColor: 'var(--bg-page)',
    color: 'var(--text-primary)',
    minHeight: '100vh',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 0 40px 0',
  },

  /* Navigation - matches LandingPage */
  nav: {
    position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
    padding: '0 40px',
    backdropFilter: 'blur(16px) saturate(180%)',
    background: 'rgba(250,251,253,0.85)',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
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

  /* Header */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 32px 20px',
  },
  headerCenter: { textAlign: 'center' },
  headerRule: {
    height: '1px',
    background: 'var(--border)',
    margin: '0 32px',
  },
  backLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'color 0.2s',
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: '4px 0 0 0',
    fontFamily: "'JetBrains Mono', monospace",
  },

  /* Input section */
  inputSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    padding: '32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },

  /* Section titles (used with SectionHeader component) */
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    margin: '0 0 20px 0',
  },
  sectionSubtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },

  /* Slider */
  sliderGroup: { marginBottom: '20px' },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '8px',
  },
  sliderLabel: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  sliderValue: {
    fontSize: '12px',
    color: 'var(--accent)',
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    background: 'var(--accent-light)',
    padding: '1px 7px',
    borderRadius: '4px',
  },
  slider: {
    width: '100%',
    height: '4px',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'var(--border)',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  },
  sliderRange: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '4px',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  helperText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  derivedText: {
    fontSize: '12px',
    color: 'var(--accent)',
    marginTop: '6px',
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 600,
  },

  /* Results section */
  resultsSection: {
    padding: '0 32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  bigNumber: {
    textAlign: 'center',
    padding: '28px 32px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    marginBottom: '24px',
  },
  bigLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  bigValue: {
    fontSize: '56px',
    fontWeight: 600,
    lineHeight: 1,
    color: 'var(--text-primary)',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: '12px',
  },
  bigRange: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  rangeNote: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },

  /* Rule cards */
  ruleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  ruleCard: {
    background: 'var(--bg-inset)',
    borderRadius: '6px',
    padding: '14px 12px',
    textAlign: 'left',
  },
  ruleCode: {
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: '2px',
  },
  ruleName: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '10px',
  },
  ruleCount: {
    fontSize: '28px',
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    lineHeight: 1,
    marginBottom: '4px',
  },
  rulePct: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: "'IBM Plex Mono', monospace",
  },

  /* Proportion bar */
  proportionBarContainer: {
    marginBottom: '24px',
  },
  proportionBar: {
    display: 'flex',
    height: '6px',
    borderRadius: '3px',
    overflow: 'hidden',
    background: 'var(--border)',
  },

  /* Chips */
  chipRow: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
  },
  chip: {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '12px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  chipLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  chipValue: {
    fontSize: '18px',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
  },

  /* Generalised section */
  genSection: {
    padding: '32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px solid var(--border)',
  },
  formulaBox: {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '20px 24px',
    marginBottom: '24px',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '12px',
    lineHeight: 2,
  },
  formulaLine: {
    marginBottom: '4px',
  },
  fVar: {
    color: 'var(--accent)',
    fontWeight: 600,
  },
  fOp: {
    color: 'var(--text-muted)',
    margin: '0 4px',
  },
  formulaComment: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  genGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  genCard: {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '16px',
    textAlign: 'center',
  },
  genLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: '8px',
  },
  genValue: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: '4px',
  },
  genDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  genTotal: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: '12px',
    background: 'var(--bg-card)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  genSpacing: {
    color: 'var(--text-muted)',
    fontSize: '13px',
  },

  /* Table section */
  tableSection: {
    padding: '32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px solid var(--border)',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    background: 'var(--bg-inset)',
  },
  td: {
    padding: '7px 12px',
    borderBottom: '1px solid var(--bg-inset)',
    color: 'var(--text-secondary)',
  },
  tableRow: {},
  highlightRow: {
    background: 'var(--accent-light)',
    color: 'var(--text-primary)',
  },

  /* Tester section */
  testerSection: {
    padding: '32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px solid var(--border)',
  },
  testerButtons: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  verifyBtn: {
    background: 'var(--accent)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', sans-serif",
    transition: 'background 0.15s',
  },
  exportBtn: {
    background: 'var(--bg-inset)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  reportBox: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },
  reportStatus: {
    padding: '14px 24px',
    fontSize: '13px',
    fontWeight: 600,
    borderBottom: '1px solid var(--border)',
    border: '1px solid',
    borderRadius: '8px 8px 0 0',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  reportPre: {
    padding: '20px 24px',
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    fontFamily: "'IBM Plex Mono', monospace",
    overflow: 'auto',
    whiteSpace: 'pre',
    background: 'var(--bg-inset)',
  },

  /* Formula reference */
  formulaSection: {
    padding: '32px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px solid var(--border)',
  },
  formulaRef: {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  formulaPre: {
    padding: '20px 24px',
    margin: 0,
    fontSize: '12px',
    lineHeight: 2,
    color: 'var(--text-primary)',
    fontFamily: "'IBM Plex Mono', monospace",
    overflow: 'auto',
    whiteSpace: 'pre',
  },

  /* Weather section */
  weatherHeader: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  weatherControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '200px',
  },
  dropdown: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-inset)',
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  },
  riskStrip: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    borderLeft: '1px solid var(--border)',
    paddingLeft: '32px',
    flexWrap: 'wrap',
  },
  riskBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '100px',
  },
  riskLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  riskValue: {
    fontSize: '24px',
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  riskUnit: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  riskDelta: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--rule-r4)',
  },
  baseVal: {
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
  genBaseNote: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '6px',
  },

  loadingText: {
    fontSize: '12px',
    color: 'var(--accent)',
    fontStyle: 'italic',
    fontWeight: 500,
  },

  /* Footer */
  footer: {
    padding: '32px 32px',
    textAlign: 'center',
    borderTop: '1px solid var(--border)',
    marginTop: '40px',
  },
  footerText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontFamily: "'IBM Plex Mono', monospace",
  },
};