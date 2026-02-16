/**
 * Simulation Lab Page
 * 
 * Dedicated page for √n sensor placement, fault injection,
 * and fault detection using PMTiles data extraction.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, CircleMarker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { leafletLayer, LineSymbolizer } from 'protomaps-leaflet';
import { Radio, Zap, ZapOff, Activity, RotateCcw, Crosshair, MapPin, ArrowLeft, AlertTriangle, CheckCircle, XCircle, Layers } from 'lucide-react';
import { buildAdjacencyList, getEnergizedStatus, findGoodBridgeFault, bfsFromSource } from '../simulation/gridEngine';
import { placeSensorsSqrtN, readSensors, identifyFaultyBlock } from '../simulation/sensorEngine';
import { extractFeaturesInBounds } from '../simulation/pmtilesExtractor';
import 'leaflet/dist/leaflet.css';
import '../index.css';

const TILES = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// ── Area Selection Component ──
function AreaSelector({ active, onAreaSelected, onCancel }) {
    const [firstCorner, setFirstCorner] = useState(null);
    const [previewBounds, setPreviewBounds] = useState(null);

    useMapEvents({
        click(e) {
            if (!active) return;
            if (!firstCorner) {
                setFirstCorner(e.latlng);
            } else {
                const bounds = {
                    north: Math.max(firstCorner.lat, e.latlng.lat),
                    south: Math.min(firstCorner.lat, e.latlng.lat),
                    east: Math.max(firstCorner.lng, e.latlng.lng),
                    west: Math.min(firstCorner.lng, e.latlng.lng),
                };
                onAreaSelected(bounds);
                setFirstCorner(null);
                setPreviewBounds(null);
            }
        },
        mousemove(e) {
            if (!active || !firstCorner) return;
            setPreviewBounds({
                north: Math.max(firstCorner.lat, e.latlng.lat),
                south: Math.min(firstCorner.lat, e.latlng.lat),
                east: Math.max(firstCorner.lng, e.latlng.lng),
                west: Math.min(firstCorner.lng, e.latlng.lng),
            });
        },
    });

    if (!active) return null;

    const rectBounds = previewBounds
        ? [[previewBounds.south, previewBounds.west], [previewBounds.north, previewBounds.east]]
        : null;

    return (
        <>
            {rectBounds && (
                <Rectangle
                    bounds={rectBounds}
                    pathOptions={{
                        color: '#00BCD4',
                        weight: 2,
                        fillColor: '#00BCD4',
                        fillOpacity: 0.12,
                        dashArray: '6 3',
                    }}
                />
            )}
        </>
    );
}

// ── Voltage tiers for simulation page ──
const SIM_VOLTAGE_TIERS = [
    { min: 765, color: '#FF1744', width: 3.0, label: '765 kV' },
    { min: 400, color: '#FF6D00', width: 2.5, label: '400 kV' },
    { min: 220, color: '#FFD600', width: 2.0, label: '220 kV' },
    { min: 132, color: '#76FF03', width: 1.5, label: '132 kV' },
    { min: 110, color: '#00E676', width: 1.3, label: '110 kV' },
    { min: 66, color: '#00B0FF', width: 1.2, label: '66 kV' },
    { min: -1, color: '#9E9E9E', width: 0.8, label: 'Other / Untagged' },
];

// ── PMTiles background overlay — always dim (context only) ──
function PMTilesBackground() {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        if (layerRef.current) map.removeLayer(layerRef.current);
        try {
            const layer = leafletLayer({
                url: '/india_grid.pmtiles',
                paintRules: [{
                    dataLayer: 'grid',
                    symbolizer: new LineSymbolizer({
                        color: '#444',
                        width: 0.4,
                        opacity: 0.2,
                    }),
                    filter: (z, f) => f?.props?.type === 'Line' || f?.props?.type === 'Cable',
                }],
                labelRules: [],
                maxDataZoom: 15,
            });
            layer.addTo(map);
            layerRef.current = layer;
        } catch (e) {
            console.error('PMTiles bg error:', e);
        }
        return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
    }, [map]);

    return null;
}

// ── Substation Markers (selected area only, zoom-responsive) ──
function SubstationMarkers({ substations, energized }) {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on('zoomend', onZoom);
        return () => map.off('zoomend', onZoom);
    }, [map]);
    if (!substations || substations.length === 0) return null;
    // Scale: radius 2 at z<=5, up to 7 at z>=12
    const t = Math.max(0, Math.min(1, (zoom - 5) / 7));
    const radius = 2 + t * 5;
    const weight = 1 + t * 1.5;
    return substations.map((s, i) => (
        <CircleMarker
            key={`sub-${i}`}
            center={[s.lat, s.lon]}
            radius={radius}
            pathOptions={{
                color: energized ? '#FF8F00' : '#666',
                fillColor: energized ? '#FFC107' : '#555',
                fillOpacity: energized ? 0.9 : 0.4,
                weight,
            }}
        >
            <Popup>
                <div style={{ fontSize: 12 }}>
                    <strong>Substation</strong>
                    {s.name && <><br />{s.name}</>}
                </div>
            </Popup>
        </CircleMarker>
    ));
}

// ── Tower Markers (selected area only, zoom >= 9) ──
function TowerMarkers({ towers, energized }) {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on('zoomend', onZoom);
        return () => map.off('zoomend', onZoom);
    }, [map]);
    if (!towers || towers.length === 0 || zoom < 9) return null;
    return towers.map((t, i) => (
        <CircleMarker
            key={`twr-${i}`}
            center={[t.lat, t.lon]}
            radius={2.5}
            pathOptions={{
                color: energized ? '#78909C' : '#555',
                fillColor: energized ? '#B0BEC5' : '#444',
                fillOpacity: energized ? 0.7 : 0.3,
                weight: 1,
            }}
        />
    ));
}

// ── Simulation Legend ──
function SimLegend({ hasData, hasSensors, hasFault, energized }) {
    return (
        <div
            className="map-legend"
            style={{
                background: 'rgba(18,18,18,0.92)',
                color: '#ddd',
                borderColor: '#333',
            }}
        >
            {/* Voltage Class */}
            <div className="legend-section-header" style={{ color: '#aaa' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                Voltage Class
            </div>
            {SIM_VOLTAGE_TIERS.map(({ label, color }) => (
                <div key={label} className="legend-row">
                    <div className="legend-swatch" style={{ background: color }} />
                    <span className="legend-label">{label}</span>
                </div>
            ))}

            {/* Infrastructure */}
            <div className="legend-section-header" style={{ color: '#aaa' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>
                Infrastructure
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="5" fill="#FFC107" stroke="#FF8F00" strokeWidth="1.5" />
                    </svg>
                </div>
                <span className="legend-label">Substation</span>
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="3" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
                    </svg>
                </div>
                <span className="legend-label">Tower <span style={{ fontSize: 9, opacity: 0.5 }}>z≥9</span></span>
            </div>

            {/* Simulation */}
            <div className="legend-section-header" style={{ color: '#aaa' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Simulation
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="5" fill="#00E676" opacity="0.8" />
                    </svg>
                </div>
                <span className="legend-label">Sensor (live)</span>
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="5" fill="#FF1744" opacity="0.8" />
                    </svg>
                </div>
                <span className="legend-label">Sensor (dead)</span>
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="4" viewBox="0 0 16 4">
                        <line x1="0" y1="2" x2="16" y2="2" stroke="#555" strokeWidth="2" opacity="0.5" />
                    </svg>
                </div>
                <span className="legend-label">De-energized line</span>
            </div>
            <div className="legend-row">
                <div className="legend-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <rect x="1" y="1" width="14" height="14" fill="none" stroke="#00BCD4" strokeWidth="1.5" strokeDasharray="4 2" />
                    </svg>
                </div>
                <span className="legend-label">Selection area</span>
            </div>
        </div>
    );
}

// ── Sensor Markers ──
function SensorMarkers({ sensors, busGeo, locations, sensorReadings }) {
    if (!sensors || !busGeo) return null;

    return sensors.map((busId, i) => {
        const loc = locations?.get(busId) || busGeo.get(busId);
        if (!loc) return null;

        // Determine status
        const isLive = sensorReadings ? (sensorReadings.get(busId) || 0) === 1 : true;

        // If snapped to a tower (has lat/lon properties), use array format [lat, lon]
        const center = Array.isArray(loc) ? loc : [loc.lat, loc.lon];

        return (
            <CircleMarker
                key={`sensor-${busId}`}
                center={center}
                radius={6}
                pathOptions={{
                    color: isLive ? '#00E676' : '#FF1744',
                    fillColor: isLive ? '#00E676' : '#FF1744',
                    fillOpacity: 0.8,
                    weight: 2,
                    className: 'sensor-pulse',
                }}
            >
                <Popup>
                    <div style={{ fontSize: 12 }}>
                        <strong>S{i + 1}</strong> — Bus {busId}<br />
                        Status: {isLive ? '✅ LIVE' : '❌ DEAD'}
                    </div>
                </Popup>
            </CircleMarker>
        );
    });
}

// ── Extracted Lines Overlay ──
function ExtractedLinesOverlay({ lines, busGeo, energized, energizedStatus }) {
    if (!lines || lines.length === 0) return null;

    function voltageColor(kv) {
        if (kv >= 765) return { color: '#FF1744', weight: 3 };
        if (kv >= 400) return { color: '#FF6D00', weight: 2.5 };
        if (kv >= 220) return { color: '#FFD600', weight: 2 };
        if (kv >= 132) return { color: '#76FF03', weight: 1.5 };
        if (kv >= 110) return { color: '#00E676', weight: 1.3 };
        if (kv >= 66) return { color: '#00B0FF', weight: 1.2 };
        return { color: '#9E9E9E', weight: 1 };
    }

    return lines.map(([idx, from, to, kv]) => {
        const fromGeo = busGeo.get(from);
        const toGeo = busGeo.get(to);
        if (!fromGeo || !toGeo) return null;

        let color, weight, opacity;

        if (energizedStatus) {
            // BFS result available — show live/dead coloring
            const fromLive = energizedStatus.get(from) || 0;
            const toLive = energizedStatus.get(to) || 0;
            if (fromLive && toLive) {
                const vc = voltageColor(kv);
                color = vc.color;
                weight = vc.weight;
                opacity = 0.9;
            } else {
                color = '#333';
                weight = 0.8;
                opacity = 0.35;
            }
        } else if (energized) {
            // Energized but no BFS yet — show voltage colors
            const vc = voltageColor(kv);
            color = vc.color;
            weight = vc.weight;
            opacity = 0.85;
        } else {
            // De-energized — dim grey
            color = '#555';
            weight = 0.7;
            opacity = 0.4;
        }

        return (
            <Polyline
                key={`line-${idx}`}
                positions={[fromGeo, toGeo]}
                pathOptions={{ color, weight, opacity }}
            />
        );
    });
}

// ── Selection Bounds Overlay ──
function SelectionBoundsOverlay({ bounds }) {
    if (!bounds) return null;
    return (
        <Rectangle
            bounds={[[bounds.south, bounds.west], [bounds.north, bounds.east]]}
            pathOptions={{
                color: '#00BCD4',
                weight: 2,
                fillColor: '#00BCD4',
                fillOpacity: 0.05,
                dashArray: '8 4',
            }}
        />
    );
}

// ── Main Simulation Page ──
export default function SimulationPage() {
    const navigate = useNavigate();

    // Simulation state
    const [areaSelectMode, setAreaSelectMode] = useState(false);
    const [selectedBounds, setSelectedBounds] = useState(null);
    const [extractedData, setExtractedData] = useState(null); // { lines, busGeo, source, stats }
    const [simState, setSimState] = useState({
        energized: true,
        sensors: [],
        locations: null, // Map<busId, {lat, lon}>
        blocks: [],
        sensorReadings: null,
        energizedStatus: null,
        faultInfo: null,
        faultyBlock: -1,
    });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const adjRef = useRef(null);
    const allBusesRef = useRef([]);

    // Toast helper
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Area Selection Handler ──
    const handleAreaSelected = useCallback(async (bounds) => {
        setAreaSelectMode(false);
        setSelectedBounds(bounds);
        setLoading(true);
        showToast('Extracting features from selected area...');

        try {
            const data = await extractFeaturesInBounds(bounds);

            if (data.lines.length === 0) {
                showToast('⚠️ No transmission lines found in selected area. Try a larger region.');
                setLoading(false);
                return;
            }

            // Build adjacency list
            const adj = buildAdjacencyList(data.lines);
            adjRef.current = adj;
            allBusesRef.current = Array.from(data.busGeo.keys());

            setExtractedData(data);

            // Auto-energize: Set flag true but status null (visual mode)
            setSimState({
                energized: true,
                sensors: [],
                locations: null,
                blocks: [],
                sensorReadings: null,
                energizedStatus: null,
                faultInfo: null,
                faultyBlock: -1,
            });

            const { stats } = data;
            showToast(
                `⚡ Extracted ${stats.linesExtracted.toLocaleString()} lines, ${stats.busCount.toLocaleString()} buses — Grid energized`
            );
        } catch (err) {
            console.error('Extraction error:', err);
            showToast('❌ Error extracting data: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // ── Sensor Placement ──
    const handlePlaceSensors = useCallback(() => {
        if (!adjRef.current || !extractedData) return;
        const t0 = performance.now();

        // Calculate target sensor count based on towers (N)
        const towers = extractedData.towers || [];
        const towerCount = towers.length;
        const targetSensors = towerCount > 0 ? Math.floor(Math.sqrt(towerCount)) : undefined;

        const { sensors, blocks } = placeSensorsSqrtN(adjRef.current, allBusesRef.current, targetSensors);

        // Snap sensors to nearest unique towers
        const locations = new Map();
        if (towerCount > 0) {
            const assignedTowers = new Set();
            sensors.forEach(busId => {
                const busLoc = extractedData.busGeo.get(busId);
                if (!busLoc) return;

                let minDst = Infinity;
                let bestIdx = -1;

                // Find nearest unique tower
                for (let i = 0; i < towers.length; i++) {
                    if (assignedTowers.has(i)) continue;
                    // Simple Euclidean distance
                    const d = (towers[i].lat - busLoc[0]) ** 2 + (towers[i].lon - busLoc[1]) ** 2;
                    if (d < minDst) {
                        minDst = d;
                        bestIdx = i;
                    }
                }

                if (bestIdx !== -1) {
                    assignedTowers.add(bestIdx);
                    locations.set(busId, towers[bestIdx]);
                }
            });
        }

        const elapsed = (performance.now() - t0).toFixed(0);

        setSimState(prev => {
            const readings = prev.energizedStatus
                ? readSensors(sensors, prev.energizedStatus) : null;
            return { ...prev, sensors, locations, blocks, sensorReadings: readings };
        });

        const sourceLabel = targetSensors ? `√${towerCount.toLocaleString()} towers` : `√${allBusesRef.current.length.toLocaleString()} buses`;
        showToast(`📡 ${sensors.length} sensors placed in ${elapsed}ms (${sourceLabel})`);
    }, [extractedData, showToast]);

    // ── Energize ──
    const handleEnergize = useCallback(() => {
        if (!adjRef.current || !extractedData) return;
        const t0 = performance.now();
        const disabled = new Set();
        if (simState.faultInfo) disabled.add(simState.faultInfo.lineIdx);
        const status = getEnergizedStatus(adjRef.current, extractedData.source, disabled, allBusesRef.current);
        const elapsed = (performance.now() - t0).toFixed(0);

        setSimState(prev => {
            const readings = prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null;
            const faultyBlock = readings
                ? identifyFaultyBlock(prev.sensors, readings) : -1;
            return {
                ...prev,
                energized: true,
                energizedStatus: status,
                sensorReadings: readings,
                faultyBlock,
            };
        });

        let live = 0;
        status.forEach(v => { if (v === 1) live++; });
        showToast(`⚡ Energized in ${elapsed}ms — ${live.toLocaleString()} / ${allBusesRef.current.length.toLocaleString()} buses live`);
    }, [extractedData, simState.faultInfo, showToast]);

    // ── De-energize ──
    const handleDeenergize = useCallback(() => {
        setSimState(prev => ({
            ...prev,
            energized: false,
            energizedStatus: null,
            sensorReadings: null,
            faultyBlock: -1,
        }));
        showToast('Grid de-energized');
    }, [showToast]);

    // ── Inject Random Fault ──
    const handleRandomFault = useCallback(() => {
        if (!extractedData || extractedData.lines.length === 0) return;
        const randomLine = extractedData.lines[Math.floor(Math.random() * extractedData.lines.length)];
        const lineIdx = randomLine[0];

        const disabled = new Set([lineIdx]);
        const status = getEnergizedStatus(adjRef.current, extractedData.source, disabled, allBusesRef.current);

        // Find sensors that went dead
        setSimState(prev => {
            const readings = prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null;
            const faultyBlock = readings
                ? identifyFaultyBlock(prev.sensors, readings) : -1;
            return {
                ...prev,
                energized: true,
                energizedStatus: status,
                faultInfo: { lineIdx },
                sensorReadings: readings,
                faultyBlock,
            };
        });

        let deadCount = 0;
        status.forEach(v => { if (v === 0) deadCount++; });
        showToast(`💥 Random fault injected on line #${lineIdx} — ${deadCount.toLocaleString()} buses dead`);
    }, [extractedData, showToast]);

    // ── Inject Bridge Fault ──
    const handleBridgeFault = useCallback(() => {
        if (!adjRef.current || !extractedData) return;
        showToast('Searching for critical bridge edge...');

        // Async to not freeze UI
        setTimeout(() => {
            const t0 = performance.now();
            // Find bridges
            const bridges = findBridges(adjRef.current);
            if (bridges.length > 0) {
                // Pick a random bridge
                const bridge = bridges[Math.floor(Math.random() * bridges.length)];
                // Find line index for this bridge
                // bridge is {u, v}. Scan lines to find idx.
                let bridgeLine = -1;
                for (const line of extractedData.lines) {
                    if ((line[1] === bridge.u && line[2] === bridge.v) ||
                        (line[1] === bridge.v && line[2] === bridge.u)) {
                        bridgeLine = line[0];
                        break;
                    }
                }

                if (bridgeLine === -1) {
                    showToast('Found bridge but could not map to line index');
                    return;
                }

                const disabled = new Set([bridgeLine]);
                const status = getEnergizedStatus(adjRef.current, extractedData.source, disabled, allBusesRef.current);
                const elapsed = (performance.now() - t0).toFixed(0);

                let deadCount = 0;
                status.forEach(v => { if (v === 0) deadCount++; });

                setSimState(prev => {
                    const readings = prev.sensors.length > 0
                        ? readSensors(prev.sensors, status) : null;
                    const faultyBlock = readings ? identifyFaultyBlock(prev.sensors, readings) : -1;
                    return {
                        ...prev,
                        energized: true,
                        energizedStatus: status,
                        faultInfo: { lineIdx: bridgeLine },
                        sensorReadings: readings,
                        faultyBlock,
                    };
                });
                showToast(`💥 Bridge fault on line #${bridgeLine} — ${deadCount.toLocaleString()} buses dead (${elapsed}ms)`);
            } else {
                showToast('No bridge edges found — grid is fully redundant');
            }
        }, 50);
    }, [extractedData, showToast]);

    // ── Repair Fault ──
    const handleRepairFault = useCallback(() => {
        if (!adjRef.current || !extractedData) return;
        const disabled = new Set();
        const status = getEnergizedStatus(adjRef.current, extractedData.source, disabled, allBusesRef.current);

        setSimState(prev => ({
            ...prev,
            energized: true,
            energizedStatus: status,
            faultInfo: null,
            faultyBlock: -1,
            sensorReadings: prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null,
        }));

        showToast('✅ Fault repaired — grid restored');
    }, [extractedData, showToast]);

    // ── Reset ──
    const handleReset = useCallback(() => {
        setSimState({
            energized: false,
            sensors: [],
            locations: null, // Reset locations too
            blocks: [],
            sensorReadings: null,
            energizedStatus: null,
            faultInfo: null,
            faultyBlock: -1,
        });
        setExtractedData(null);
        setSelectedBounds(null);
        adjRef.current = null;
        allBusesRef.current = [];
        showToast('Simulation reset');
    }, [showToast]);

    // ── Derived state ──
    const hasData = !!extractedData;
    const hasSensors = simState.sensors.length > 0;
    const hasFault = !!simState.faultInfo;
    const { sensors, sensorReadings, faultyBlock, blocks } = simState;

    let liveSensors = 0, deadSensors = 0;
    if (sensorReadings) {
        sensorReadings.forEach(v => { if (v === 1) liveSensors++; else deadSensors++; });
    }

    return (
        <div className="app">
            {/* Status Bar */}
            <div className="status-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                        }}
                    >
                        <ArrowLeft size={14} /> Grid Viewer
                    </button>
                    <span style={{ color: '#555' }}>|</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#ddd' }}>
                        <Activity size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                        Simulation Lab
                    </span>
                </div>
                <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 16 }}>
                    {hasData && (
                        <>
                            <span>Buses: {extractedData.stats.busCount.toLocaleString()}</span>
                            <span>Lines: {extractedData.stats.linesExtracted.toLocaleString()}</span>
                            {hasSensors && <span>Sensors: {sensors.length}</span>}
                        </>
                    )}
                </div>
            </div>

            <div className="app-body">
                {/* Left Panel — Controls */}
                <div className="control-panel" style={{ minWidth: 220 }}>
                    {/* Step 1: Area Selection */}
                    <div className="panel-section">
                        <div className="section-title">
                            <Crosshair size={12} style={{ marginRight: 6 }} /> 1. Select Area
                        </div>
                        <button
                            className={`btn ${areaSelectMode ? 'btn-active' : ''}`}
                            onClick={() => {
                                if (areaSelectMode) {
                                    setAreaSelectMode(false);
                                } else {
                                    setAreaSelectMode(true);
                                    showToast('Click two corners on the map to draw selection area');
                                }
                            }}
                            disabled={loading}
                            style={areaSelectMode ? { background: '#00BCD4', color: '#000' } : {}}
                        >
                            <MapPin size={14} />
                            {areaSelectMode ? 'Cancel Selection' : 'Draw Area on Map'}
                        </button>
                        {loading && (
                            <div style={{ fontSize: 11, color: '#00BCD4', textAlign: 'center', marginTop: 6 }}>
                                Extracting features...
                            </div>
                        )}
                        {hasData && (
                            <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 4 }}>
                                {extractedData.stats.linesExtracted} lines, {extractedData.stats.busCount} buses
                                {extractedData.stats.voidCount > 0 && (
                                    <span style={{ color: '#f59e0b' }}> ({extractedData.stats.voidCount} voids patched)</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Sensor Placement */}
                    <div className="panel-section">
                        <div className="section-title">
                            <Radio size={12} style={{ marginRight: 6 }} /> 2. Sensors
                        </div>
                        <button
                            className="btn"
                            onClick={handlePlaceSensors}
                            disabled={!hasData || hasSensors}
                        >
                            <Radio size={14} /> Place √n Sensors
                        </button>
                        {hasSensors && (
                            <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 }}>
                                {sensors.length} sensors in {blocks.length} blocks
                            </div>
                        )}
                    </div>

                    {/* Step 3: Grid Control */}
                    <div className="panel-section">
                        <div className="section-title">
                            <Zap size={12} style={{ marginRight: 6 }} /> 3. Grid Control
                        </div>
                        <div className={`toggle-row ${simState.energized ? 'active' : ''}`}>
                            <span className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {simState.energized ? <Zap size={14} color="#FFD600" /> : <ZapOff size={14} color="#555" />}
                                {simState.energized ? 'Energized' : 'De-energized'}
                            </span>
                            <div
                                className={`toggle-switch ${simState.energized ? 'on' : ''}`}
                                onClick={() => {
                                    if (!hasData) return;
                                    simState.energized ? handleDeenergize() : handleEnergize();
                                }}
                                style={!hasData ? { opacity: 0.3, pointerEvents: 'none' } : {}}
                            />
                        </div>
                    </div>

                    {/* Step 4: Fault Injection */}
                    <div className="panel-section">
                        <div className="section-title">
                            <Activity size={12} style={{ marginRight: 6 }} /> 4. Fault Injection
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                                className="btn"
                                onClick={handleRandomFault}
                                disabled={!hasData}
                            >
                                <Activity size={14} /> Random Fault
                            </button>
                            <button
                                className="btn"
                                onClick={handleBridgeFault}
                                disabled={!hasData}
                            >
                                <AlertTriangle size={14} /> Bridge Fault
                            </button>
                            {hasFault && (
                                <button className="btn" onClick={handleRepairFault}>
                                    <CheckCircle size={14} /> Repair Fault
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Reset */}
                    <div className="panel-section" style={{ borderTop: '1px solid #222', paddingTop: 12 }}>
                        <button className="btn" onClick={handleReset}>
                            <RotateCcw size={14} /> Reset All
                        </button>
                    </div>
                </div>

                {/* Center — Map */}
                <div className="map-container" style={{ cursor: areaSelectMode ? 'crosshair' : 'grab' }}>
                    <MapContainer
                        center={[22.5, 78.5]}
                        zoom={5}
                        style={{ width: '100%', height: '100%' }}
                        preferCanvas={true}
                    >
                        <TileLayer url={TILES.dark} maxZoom={19} />
                        <PMTilesBackground />
                        <AreaSelector
                            active={areaSelectMode}
                            onAreaSelected={handleAreaSelected}
                            onCancel={() => setAreaSelectMode(false)}
                        />
                        <SelectionBoundsOverlay bounds={selectedBounds} />
                        <ExtractedLinesOverlay
                            lines={extractedData?.lines}
                            busGeo={extractedData?.busGeo}
                            energized={simState.energized}
                            energizedStatus={simState.energizedStatus}
                        />
                        <SubstationMarkers
                            substations={extractedData?.substations}
                            energized={simState.energized}
                        />
                        <TowerMarkers
                            towers={extractedData?.towers}
                            energized={simState.energized}
                        />
                        <SensorMarkers
                            sensors={simState.sensors}
                            busGeo={extractedData?.busGeo}
                            locations={simState.locations}
                            sensorReadings={sensorReadings}
                        />
                    </MapContainer>

                    {/* Legend */}
                    <SimLegend
                        hasData={hasData}
                        hasSensors={hasSensors}
                        hasFault={hasFault}
                        energized={simState.energized}
                    />

                    {/* Area select hint */}
                    {areaSelectMode && (
                        <div style={{
                            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                            zIndex: 1000, background: 'rgba(0,188,212,0.9)', color: '#000',
                            padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                            pointerEvents: 'none',
                        }}>
                            <Crosshair size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                            Click two corners to define the area
                        </div>
                    )}
                </div>

                {/* Right — Sensor Panel */}
                <div className="sensor-panel">
                    <div className="panel-header">
                        <h3><Radio size={14} style={{ marginRight: 8 }} /> Sensors{hasSensors ? ` (${sensors.length})` : ''}</h3>
                    </div>

                    {!hasSensors ? (
                        <div className="empty-state">
                            <div className="icon"><Radio size={32} /></div>
                            <div style={{ marginTop: 12 }}>No sensors placed</div>
                            <div style={{ fontSize: 11, color: '#444' }}>
                                {hasData ? 'Click "Place √n Sensors" to begin' : 'Select an area first'}
                            </div>
                        </div>
                    ) : (
                        <>
                            {sensorReadings && (
                                <div className="sensor-summary">
                                    <span className="live-count" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckCircle size={12} /> {liveSensors} Live
                                    </span>
                                    <span className="dead-count" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <XCircle size={12} /> {deadSensors} Dead
                                    </span>
                                </div>
                            )}

                            {faultyBlock >= 0 && (
                                <div style={{
                                    padding: '12px 16px',
                                    background: 'var(--surface-hover)',
                                    borderBottom: '1px solid var(--border)',
                                    marginBottom: 10,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                                        Fault Analysis
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {faultyBlock > 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                <CheckCircle size={14} color="var(--sensor-live)" />
                                                <div>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>S{faultyBlock}</span>
                                                    <span style={{ margin: '0 6px', color: '#666' }}>→</span>
                                                    <span style={{ color: 'var(--sensor-live)' }}>Last Live</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                <AlertTriangle size={14} color="var(--sensor-dead)" />
                                                <span style={{ color: 'var(--text-muted)' }}>Fault before first sensor</span>
                                            </div>
                                        )}
                                        <div style={{ marginLeft: 6, height: 12, borderLeft: '1px dashed #666' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                            <XCircle size={14} color="var(--sensor-dead)" />
                                            <div>
                                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>S{faultyBlock + 1}</span>
                                                <span style={{ margin: '0 6px', color: '#666' }}>→</span>
                                                <span style={{ color: 'var(--sensor-dead)' }}>First Dead</span>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: 6, borderRadius: 4 }}>
                                            Fault isolated between <strong>S{faultyBlock > 0 ? faultyBlock : 'Source'}</strong> and <strong>S{faultyBlock + 1}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="sensor-list">
                                {sensors.map((busId, i) => {
                                    const isLive = sensorReadings ? (sensorReadings.get(busId) || 0) === 1 : true;
                                    const isFaultBlock = faultyBlock === i;
                                    const blockSize = blocks && blocks[i] ? blocks[i].length : 0;
                                    return (
                                        <div key={busId} className={`sensor-item ${isFaultBlock ? 'fault-block' : ''}`}>
                                            <div className={`sensor-dot ${isLive ? 'live' : 'dead'}`} />
                                            <span className="sensor-id">S{i + 1}</span>
                                            <span className="sensor-bus">B{busId}</span>
                                            <span className="sensor-bus" style={{ fontSize: 10, color: '#555' }}>
                                                [{blockSize}]
                                            </span>
                                            <span className={`sensor-status ${isLive ? 'live' : 'dead'}`}>
                                                {isLive ? 'LIVE' : 'DEAD'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
