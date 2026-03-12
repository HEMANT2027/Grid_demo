/**
 * Infrastructure Planner Page
 *
 * Standalone module for defining Indian Grid infrastructure using three methods:
 *   1. Search & Clip from existing PostGIS database
 *   2. File Import (GeoJSON / CSV)
 *   3. Interactive Drawing on the OSM map
 *
 * All input feeds into a unified state → automatic sensor placement pipeline.
 * Sensors are computed algorithmically — the user only provides topology.
 *
 * Architecture: Fully isolated from the Simulation page.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PlannerMap from '../planner/PlannerMap';
import { runPipeline } from '../planner/plannerEngine';
import { parseGeoJSON, parseCSV } from '../planner/fileParser';

/* ════════════════════════════════════════════════════════
   STYLES — Light Professional Theme (matches SensorPredictor)
   ════════════════════════════════════════════════════════ */
const CSS = {
  '--bg-page':       '#F8F9FB',
  '--bg-card':       '#FFFFFF',
  '--bg-inset':      '#F1F4F8',
  '--border':        '#E2E6ED',
  '--text-primary':  '#0F172A',
  '--text-secondary':'#5A6478',
  '--text-muted':    '#9BA3AF',
  '--accent':        '#1A56DB',
  '--accent-light':  '#EBF1FF',
  '--green':         '#0E9F6E',
  '--orange':        '#E8590C',
};

const s = {
  pageWrap: {
    ...CSS,
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: 'var(--text-primary)',
    background: 'var(--bg-page)',
  },

  /* ── Sidebar ─────────────────────────────── */
  sidebar: {
    width: 340,
    minWidth: 340,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
    zIndex: 10,
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backLink: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '10px 0 2px',
    color: 'var(--text-primary)',
  },
  pageSubtitle: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: "'IBM Plex Mono', monospace",
    margin: 0,
  },

  /* ── Tabs ─────────────────────────────────── */
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  tab: (active) => ({
    flex: 1,
    padding: '10px 4px',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    background: active ? 'var(--bg-page)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'all 0.15s ease',
    userSelect: 'none',
  }),

  /* ── Tab content area ────────────────────── */
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
  placeholder: {
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--text-muted)',
    fontSize: 12,
    lineHeight: 1.6,
  },
  placeholderIcon: {
    fontSize: 28,
    marginBottom: 8,
    opacity: 0.4,
  },
  placeholderTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },

  /* ── Sensor interval control ──────────────── */
  controlGroup: {
    marginBottom: 16,
  },
  controlLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 6,
  },
  controlValue: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    background: 'var(--accent-light)',
    padding: '1px 6px',
    borderRadius: 3,
  },
  slider: {
    width: '100%',
    height: 4,
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'var(--border)',
    borderRadius: 2,
    outline: 'none',
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  },
  sliderRange: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 3,
    fontFamily: "'IBM Plex Mono', monospace",
  },

  /* ── Metrics card ────────────────────────── */
  metricsCard: {
    flexShrink: 0,
    borderTop: '1px solid var(--border)',
    padding: '14px 20px',
    background: 'var(--bg-inset)',
  },
  metricsTitle: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 10,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },

  /* ── Map container ───────────────────────── */
  mapContainer: {
    flex: 1,
    height: '100vh',
    position: 'relative',
  },

  /* ── Toast ───────────────────────────────── */
  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0F172A',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    zIndex: 9999,
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    fontFamily: "'IBM Plex Sans', sans-serif",
    transition: 'opacity 0.3s',
  },

  /* ── Empty state on map ──────────────────── */
  emptyOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 800,
    textAlign: 'center',
    padding: '32px 40px',
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    pointerEvents: 'none',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#5A6478',
    lineHeight: 1.5,
  },
  /* ── Drag and drop zone ──────────────────── */
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 8,
    padding: '32px 20px',
    textAlign: 'center',
    background: 'var(--bg-page)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-light)',
  },
  /* ── Form inputs ─────────────────────────── */
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  },
  inputRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '10px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  buttonOutline: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 16,
  },
};

/* ════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════ */
export default function InfrastructurePlannerPage() {
  /* ── Inject fonts ── */
  useEffect(() => {
    const id = '__ibm-plex-fonts-planner';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  /* ── Core state ── */
  const [nodes, setNodes]                 = useState([]);           // { id, lat, lon, type, voltage?, name? }
  const [edges, setEdges]                 = useState([]);           // { id, source, target, voltage }
  const [sensorLocations, setSensors]     = useState([]);           // node IDs
  const [pipelineResult, setPipelineResult] = useState(null);       // { metrics }
  const [activeTab, setActiveTab]         = useState('draw');       // 'clip' | 'import' | 'draw'
  const [sensorInterval, setSensorInterval] = useState(5);          // L (hops)
  const [toast, setToast]                 = useState(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [isLoadingDB, setIsLoadingDB]     = useState(false);
  
  // Manual interactions
  const [manualSensors, setManualSensors] = useState(new Set());
  const [nodeClickMode, setNodeClickMode] = useState('info');       // 'info' | 'substation' | 'sensor'
  
  // DB Clip Form State
  const [bounds, setBounds] = useState({
    min_lon: '76.5', // Default Delhi NCR
    min_lat: '28.4',
    max_lon: '77.8',
    max_lat: '28.9'
  });

  const fileInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── ✍️ Handle Map Drawing Events ── */
  const handleDrawCreated = useCallback((e) => {
    const { layerType, layer } = e;

    // Generous snap threshold: ~5-10km on map (easy to click precisely)
    const SNAP_THRESHOLD = 0.05;

    if (layerType === 'marker') {
      const type = 'substation';
      const latlng = layer.getLatLng();
      
      setNodes((prevNodes) => {
        const newNodes = prevNodes.slice();
        
        let snapped = false;
        for (let i = 0; i < newNodes.length; i++) {
          const n = newNodes[i];
          const dLat = Math.abs(n.lat - latlng.lat);
          const dLon = Math.abs(n.lon - latlng.lng);
          if (dLat < SNAP_THRESHOLD && dLon < SNAP_THRESHOLD) {
            newNodes[i] = { ...n, type: type };
            snapped = true;
            break;
          }
        }

        if (!snapped) {
          newNodes.push({
            id: `${type}_${Date.now()}`,
            type: type,
            lat: latlng.lat,
            lon: latlng.lng,
          });
        }
        
        return newNodes;
      });
      
      showToast('Substation placed');
    }
    else if (layerType === 'polyline') {
      // Transmission Line (Edge)
      const latlngs = layer.getLatLngs();
      if (latlngs.length < 2) return;

      setNodes((prevNodes) => {
        const newNodes = prevNodes.slice();
        const newEdges = [];
        
        // Helper to find or create a node at a given latlng
        const findOrCreateNode = (ll) => {
          for (const n of newNodes) {
            const dLat = Math.abs(n.lat - ll.lat);
            const dLon = Math.abs(n.lon - ll.lng);
            if (dLat < SNAP_THRESHOLD && dLon < SNAP_THRESHOLD) {
              return n.id;
            }
          }
          // Create new node parameter defaults to pole since we completely removed "buses/junctions"
          const type = 'pole'; 
          const id = `${type}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
          newNodes.push({ id, type, lat: ll.lat, lon: ll.lng });
          return id;
        };

        let prevNodeId = findOrCreateNode(latlngs[0]);

        for (let i = 1; i < latlngs.length; i++) {
          const currNodeId = findOrCreateNode(latlngs[i]);
          newEdges.push({
            id: `edge_${Date.now()}_${i}`,
            source: prevNodeId,
            target: currNodeId,
            voltage: 132 // Default voltage for drawn lines
          });
          prevNodeId = currNodeId;
        }

        setEdges((prevEdges) => prevEdges.concat(newEdges));
        return newNodes;
      });
      showToast('Transmission Line added');
    }
  }, [showToast]);

  /* ── 🖱️ Handle Node Click Events ── */
  const handleNodeClick = useCallback((node) => {
    if (nodeClickMode === 'info') return;

    if (nodeClickMode === 'substation') {
      setNodes((prev) => prev.map(n => 
        n.id === node.id 
          ? { ...n, type: n.type === 'substation' ? 'pole' : 'substation' } 
          : n
      ));
      showToast(node.type === 'substation' ? 'Removed Substation' : 'Added Substation');
    } else if (nodeClickMode === 'sensor') {
      setManualSensors((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
          showToast('Removed Manual Sensor');
        } else {
          next.add(node.id);
          showToast('Added Manual Sensor');
        }
        return next;
      });
    }
  }, [nodeClickMode, showToast]);

  /* ── 🗑️ Clear Topology ── */
  const handleClear = () => {
    if (confirm('Clear all drawn infrastructure?')) {
      setNodes([]);
      setEdges([]);
      setSensors([]);
      setManualSensors(new Set());
      setPipelineResult(null);
    }
  };

  /* ── 📁 Handle File Imports ── */
  const processFile = async (file) => {
    if (!file) return;
    
    const text = await file.text();
    const isJSON = file.name.endsWith('.json') || file.name.endsWith('.geojson');
    const isCSV = file.name.endsWith('.csv');

    let result = { nodes: [], edges: [], error: 'Unsupported file format' };

    if (isJSON) result = parseGeoJSON(text);
    else if (isCSV) result = parseCSV(text);

    if (result.error) {
      showToast(result.error);
      return;
    }

    if (result.nodes.length > 0 || result.edges.length > 0) {
      setNodes(prev => prev.concat(result.nodes));
      setEdges(prev => prev.concat(result.edges));
      showToast(`Imported ${result.nodes.length} nodes, ${result.edges.length} edges`);
    } else {
      showToast('No valid infrastructure data found in file.');
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  /* ── 🔍 Handle DB Search & Clip ── */
  const handleFetchDB = async (e) => {
    e?.preventDefault();
    setIsLoadingDB(true);
    showToast('Querying database...');
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const qs = `?min_lon=${bounds.min_lon}&min_lat=${bounds.min_lat}&max_lon=${bounds.max_lon}&max_lat=${bounds.max_lat}`;
      
      const res = await fetch(`${apiUrl}/grid-data${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Map API arrays to our Object structures
      // buses: [id, lon, lat, voltage?]
      const newNodes = [];
      
      if (data.buses) {
        data.buses.forEach(b => newNodes.push({ id: `db_bus_${b[0]}`, lat: b[2], lon: b[1], type: 'bus', voltage: b[3] }));
      }
      if (data.substations) {
        // substations: [lon, lat, voltage, name]
        data.substations.forEach((s, i) => newNodes.push({ id: `db_sub_${Date.now()}_${i}`, lat: s[1], lon: s[0], type: 'substation', voltage: s[2], name: s[3] }));
      }
      if (data.towers) {
        // towers: [lon, lat]
        data.towers.forEach((t, i) => newNodes.push({ id: `db_tow_${Date.now()}_${i}`, lat: t[1], lon: t[0], type: 'tower' }));
      }
      if (data.poles) {
        // poles: [lon, lat]
        data.poles.forEach((p, i) => newNodes.push({ id: `db_pol_${Date.now()}_${i}`, lat: p[1], lon: p[0], type: 'pole' }));
      }
      
      // Override bus types if they are actually substation sources
      if (data.substation_sources && data.substation_sources.length > 0) {
        const subIds = new Set(data.substation_sources.map(String));
        newNodes.forEach(n => {
          if (n.type === 'bus' && subIds.has(n.id.replace('db_bus_', ''))) {
            n.type = 'substation';
          }
        });
      }

      // lines: [id, source, target, voltage, name]
      const newEdges = [];
      if (data.lines) {
        data.lines.forEach(l => {
           // We need to map source/target to the IDs we generated for buses, handling substitutions
           const sourceIdStr = String(l[1]);
           const targetIdStr = String(l[2]);
           newEdges.push({
             id: `db_edge_${l[0]}`,
             source: newNodes.find(n => n.id.includes(`_${sourceIdStr}`))?.id || `db_bus_${sourceIdStr}`,
             target: newNodes.find(n => n.id.includes(`_${targetIdStr}`))?.id || `db_bus_${targetIdStr}`,
             voltage: l[3],
             name: l[4]
           });
        });
      }

      setNodes(prev => prev.concat(newNodes));
      setEdges(prev => prev.concat(newEdges));
      
      showToast(`Loaded ${newNodes.length} nodes from DB`);
      
    } catch (err) {
      showToast(`DB Fetch failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoadingDB(false);
    }
  };

  const setDelhiNCR = () => {
    setBounds({ min_lon: '76.5', min_lat: '28.4', max_lon: '77.8', max_lat: '28.9' });
  };

  /* ── 🚀 Run Pipeline ── */
  const handleRunPipeline = useCallback(() => {
    if (nodes.length === 0 || edges.length === 0) {
      setSensors([]);
      setPipelineResult(null);
      showToast('Need topology to run pipeline');
      return;
    }

    const t0 = performance.now();
    const result = runPipeline(nodes, edges, sensorInterval);
    const elapsed = (performance.now() - t0).toFixed(0);

    setSensors(result.sensors);
    setPipelineResult(result);

    if (result.sensors.length > 0) {
      showToast(`Pipeline ran in ${elapsed}ms. Placed ${result.sensors.length} sensors.`);
    } else {
      showToast(`Pipeline ran in ${elapsed}ms. No sensors placed.`);
    }
  }, [nodes, edges, sensorInterval, showToast]);

  /* ── Metrics shorthand ── */
  const m = pipelineResult?.metrics;

  return (
    <div style={s.pageWrap}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={s.sidebar}>
        {/* Header */}
        <div style={s.sidebarHeader}>
          <a href="/" style={s.backLink}>&#8592; Home</a>
          <h1 style={s.pageTitle}>Infrastructure Planner</h1>
          <p style={s.pageSubtitle}>
            topology → sensors &middot; OSM India &middot; client-side
          </p>
        </div>

        {/* Tabs */}
        <div style={s.tabBar}>
          {[
            { key: 'draw',   label: 'Draw' },
            { key: 'import', label: 'Import' },
            { key: 'clip',   label: 'Search & Clip' },
          ].map(({ key, label }) => (
            <div
              key={key}
              style={s.tab(activeTab === key)}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={s.tabContent}>
          {/* ── Sensor Placement Trigger ── */}
          <div style={s.controlGroup}>
            <button
              onClick={handleRunPipeline}
              style={{
                width: '100%', padding: '10px', marginBottom: '16px',
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(26,86,219,0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              🚀 Run Sensor Placement
            </button>
            <div style={s.controlLabel}>
              <span>Sensor Interval (L)</span>
              <span style={s.controlValue}>{sensorInterval} hops</span>
            </div>
            <input
              type="range"
              min={2}
              max={100}
              value={sensorInterval}
              onChange={(e) => setSensorInterval(parseInt(e.target.value))}
              style={s.slider}
            />
            <div style={s.sliderRange}>
              <span>2</span>
              <span>100</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 16px' }} />

          {/* ── Tab placeholders ── */}
          {activeTab === 'draw' && (
            <div style={s.placeholder}>
              <div style={s.placeholderIcon}>✏️</div>
              <div style={s.placeholderTitle}>Interactive Drawing</div>
              <div style={{ textAlign: 'left', margin: '12px 0 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                <strong>1. Draw the Topology</strong><br/>
                Use the <span style={{color:'var(--accent)'}}>Polyline</span> tool (top right) to draw transmission lines. Vertices automatically become poles.<br/><br/>
                
                <strong>2. Map Click Interactions</strong><br/>
                Choose an action below, then click any node directly on the map to modify it:
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, textAlign: 'left', background: 'var(--bg-page)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: nodeClickMode === 'info' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  <input type="radio" checked={nodeClickMode === 'info'} onChange={() => setNodeClickMode('info')} style={{ cursor: 'pointer' }} />
                  <strong>View Info</strong> (Hover/Click to see tooltip)
                </label>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: nodeClickMode === 'substation' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  <input type="radio" checked={nodeClickMode === 'substation'} onChange={() => setNodeClickMode('substation')} style={{ cursor: 'pointer' }} />
                  <strong>Toggle Substation</strong> (Convert pole ↔ substation)
                </label>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: nodeClickMode === 'sensor' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  <input type="radio" checked={nodeClickMode === 'sensor'} onChange={() => setNodeClickMode('sensor')} style={{ cursor: 'pointer' }} />
                  <strong>Toggle Manual Sensor</strong> (Add/remove green sensor)
                </label>
              </div>
              <button 
                onClick={handleClear}
                style={{
                  marginTop: 12, width: '100%', padding: '8px', 
                  background: '#FEE2E2', color: '#DC2626', 
                  border: '1px solid #FCA5A5', borderRadius: 6, 
                  fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Clear Map
              </button>
            </div>
          )}

          {activeTab === 'import' && (
            <div style={s.placeholder}>
              <div style={s.placeholderIcon}>📁</div>
              <div style={s.placeholderTitle}>File Import</div>
              <div style={{ fontSize: 11, marginBottom: 16 }}>
                <strong>Supported formats:</strong>
                <br />
                • GeoJSON (FeatureCollection with <code>power</code> tags)
                <br />
                • CSV (columns: <code>type, id, lat, lon</code> or <code>source, target</code>)
              </div>

              <div 
                style={{...s.dropZone, ...(isDragging ? s.dropZoneActive : {})}}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}>📤</div>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>
                  Click to browse
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  or drag and drop a file here
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".csv,.json,.geojson"
                  onChange={(e) => processFile(e.target.files[0])}
                />
              </div>

              <button 
                onClick={handleClear}
                style={{
                  marginTop: 16, width: '100%', padding: '8px', 
                  background: '#FEE2E2', color: '#DC2626', 
                  border: '1px solid #FCA5A5', borderRadius: 6, 
                  fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Clear Map
              </button>
            </div>
          )}

          {activeTab === 'clip' && (
            <div style={{ padding: '0 4px' }}>
              <div style={{...s.placeholderTitle, textAlign: 'center', marginBottom: 16}}>
                <span style={{fontSize: 20, display:'block', marginBottom: 8}}>🔍</span>
                Query PostGIS Database
              </div>
              
              <button onClick={setDelhiNCR} style={s.buttonOutline}>
                Load Preset: Delhi NCR
              </button>

              <form onSubmit={handleFetchDB}>
                <div style={s.inputRow}>
                  <div style={s.inputGroup}>
                    <label style={s.label}>Min Longitude</label>
                    <input type="text" style={s.input} value={bounds.min_lon} onChange={e => setBounds({...bounds, min_lon: e.target.value})} required />
                  </div>
                  <div style={s.inputGroup}>
                    <label style={s.label}>Max Longitude</label>
                    <input type="text" style={s.input} value={bounds.max_lon} onChange={e => setBounds({...bounds, max_lon: e.target.value})} required />
                  </div>
                </div>
                
                <div style={s.inputRow}>
                  <div style={s.inputGroup}>
                    <label style={s.label}>Min Latitude</label>
                    <input type="text" style={s.input} value={bounds.min_lat} onChange={e => setBounds({...bounds, min_lat: e.target.value})} required />
                  </div>
                  <div style={s.inputGroup}>
                    <label style={s.label}>Max Latitude</label>
                    <input type="text" style={s.input} value={bounds.max_lat} onChange={e => setBounds({...bounds, max_lat: e.target.value})} required />
                  </div>
                </div>

                <button type="submit" style={{...s.button, opacity: isLoadingDB ? 0.7 : 1}} disabled={isLoadingDB}>
                  {isLoadingDB ? 'Fetching Data...' : 'Clip & Load Infrastructure'}
                </button>
              </form>

              <button 
                onClick={handleClear}
                style={{
                  marginTop: 16, width: '100%', padding: '8px', 
                  background: '#FEE2E2', color: '#DC2626', 
                  border: '1px solid #FCA5A5', borderRadius: 6, 
                  fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Clear Map
              </button>
            </div>
          )}
        </div>

        {/* ── Pipeline Metrics ── */}
        <div style={s.metricsCard}>
          <div style={s.metricsTitle}>Pipeline Output</div>
          {m ? (
            <div style={s.metricsGrid}>
              <div style={s.metricItem}>
                <span style={s.metricLabel}>Nodes</span>
                <span style={s.metricValue}>{m.totalNodes.toLocaleString()}</span>
              </div>
              <div style={s.metricItem}>
                <span style={s.metricLabel}>Edges</span>
                <span style={s.metricValue}>{m.totalEdges.toLocaleString()}</span>
              </div>
              <div style={s.metricItem}>
                <span style={{ ...s.metricLabel, color: 'var(--green)' }}>Sensors</span>
                <span style={{ ...s.metricValue, color: 'var(--green)' }}>
                  {m.sensorsPlaced.toLocaleString()}
                </span>
              </div>
              <div style={s.metricItem}>
                <span style={s.metricLabel}>Resolution (N/k)</span>
                <span style={s.metricValue}>{m.systemResolution}</span>
              </div>
              <div style={s.metricItem}>
                <span style={s.metricLabel}>Max Span</span>
                <span style={s.metricValue}>{(m.maxSpanGap / 1000).toFixed(2)} km</span>
              </div>
              <div style={s.metricItem}>
                <span style={s.metricLabel}>Avg Span</span>
                <span style={s.metricValue}>{(m.avgSpanGap / 1000).toFixed(2)} km</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              Add grid topology to see results
            </div>
          )}
        </div>
      </aside>

      {/* ═══ MAP ═══ */}
      <div style={s.mapContainer}>
        <PlannerMap
          nodes={nodes}
          edges={edges}
          sensorLocations={Array.from(new Set(sensorLocations.concat(Array.from(manualSensors))))}
          drawModeEnabled={activeTab === 'draw'}
          onDrawCreated={handleDrawCreated}
          onNodeClick={handleNodeClick}
        />


      </div>

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
