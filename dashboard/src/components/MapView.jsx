import React, { useEffect, useRef } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { leafletLayer, LineSymbolizer } from 'protomaps-leaflet';

const TILES = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// ── Theme-adaptive voltage palettes ──
const VOLTAGE_TIERS_BY_THEME = {
    dark: [
        { min: 765, color: '#FF1744', width: 3.0, label: '765 kV' },
        { min: 400, color: '#FF6D00', width: 2.5, label: '400 kV' },
        { min: 220, color: '#FFD600', width: 2.0, label: '220 kV' },
        { min: 132, color: '#76FF03', width: 1.5, label: '132 kV' },
        { min: 110, color: '#00E676', width: 1.3, label: '110 kV' },
        { min: 66, color: '#00B0FF', width: 1.2, label: '66 kV' },
        { min: -1, color: '#9E9E9E', width: 0.8, label: 'Other / Untagged (HV)' },
    ],
    light: [
        { min: 765, color: '#C62828', width: 3.0, label: '765 kV' },
        { min: 400, color: '#E65100', width: 2.5, label: '400 kV' },
        { min: 220, color: '#F57F17', width: 2.0, label: '220 kV' },
        { min: 132, color: '#2E7D32', width: 1.5, label: '132 kV' },
        { min: 110, color: '#1B5E20', width: 1.3, label: '110 kV' },
        { min: 66, color: '#0277BD', width: 1.2, label: '66 kV' },
        { min: -1, color: '#757575', width: 0.8, label: 'Other / Untagged (HV)' },
    ],
    satellite: [
        { min: 765, color: '#FF5252', width: 3.5, label: '765 kV' },
        { min: 400, color: '#FFAB40', width: 3.0, label: '400 kV' },
        { min: 220, color: '#FFFF00', width: 2.5, label: '220 kV' },
        { min: 132, color: '#69F0AE', width: 2.0, label: '132 kV' },
        { min: 110, color: '#00E676', width: 1.8, label: '110 kV' },
        { min: 66, color: '#40C4FF', width: 1.8, label: '66 kV' },
        { min: -1, color: '#BDBDBD', width: 1.2, label: 'Other / Untagged (HV)' },
    ],
};

const MARKER_THEMES = {
    dark: {
        subFill: '#FFC107', subStroke: '#FF8F00', subDot: '#FF8F00',
        towerFill: '#78909C', towerStroke: '#546E7A',
    },
    light: {
        subFill: '#FF8F00', subStroke: '#E65100', subDot: '#E65100',
        towerFill: '#455A64', towerStroke: '#263238',
    },
    satellite: {
        subFill: '#FFD54F', subStroke: '#FFFFFF', subDot: '#FFFFFF',
        towerFill: '#B0BEC5', towerStroke: '#FFFFFF',
    },
};

const LEGEND_THEMES = {
    dark: { bg: 'rgba(18,18,18,0.92)', text: '#ddd', border: '#333', titleColor: '#aaa' },
    light: { bg: 'rgba(255,255,255,0.95)', text: '#222', border: '#ccc', titleColor: '#666' },
    satellite: { bg: 'rgba(20,20,20,0.88)', text: '#eee', border: '#444', titleColor: '#bbb' },
};

function getVoltageTierIndex(voltageStr, tiers) {
    // Empty or missing voltage → last tier (Other/Untagged)
    if (!voltageStr || voltageStr.trim() === '') return tiers.length - 1;
    const kv = parseInt(voltageStr);
    if (isNaN(kv) || kv <= 0) return tiers.length - 1;
    for (let i = 0; i < tiers.length - 1; i++) {
        if (kv >= tiers[i].min) return i;
    }
    return tiers.length - 1;
}

// ── Custom Diamond symbolizer (substations) — zoom-responsive ──
class DiamondSymbolizer {
    constructor({ size, fill, stroke, dotFill, strokeWidth = 1.5, opacity = 1 }) {
        this.baseSize = size;
        this.fill = fill;
        this.stroke = stroke;
        this.dotFill = dotFill;
        this.baseStrokeWidth = strokeWidth;
        this.opacity = opacity;
    }
    draw(ctx, geom, z, feature) {
        const pt = geom[0]?.[0];
        if (!pt) return;
        const { x, y } = pt;
        // Zoom-responsive scaling: tiny at z<=4, full at z>=12
        const t = Math.max(0, Math.min(1, (z - 4) / 8)); // 0→1 over z 4→12
        const scale = 0.3 + t * 0.7; // 30%→100%
        const s = this.baseSize * scale;
        const sw = this.baseStrokeWidth * scale;
        const dotR = Math.max(0.5, 1.5 * scale);
        ctx.save();
        ctx.globalAlpha = this.opacity * (0.5 + t * 0.5); // fade in slightly
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fillStyle = this.fill;
        ctx.fill();
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = sw;
        ctx.stroke();
        if (s > 2) { // only draw center dot when large enough
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fillStyle = this.dotFill;
            ctx.fill();
        }
        ctx.restore();
    }
}

// ── Custom Triangle symbolizer (towers) ──
class TriangleSymbolizer {
    constructor({ size, fill, stroke, strokeWidth = 0.5, opacity = 0.7 }) {
        this.size = size;
        this.fill = fill;
        this.stroke = stroke;
        this.strokeWidth = strokeWidth;
        this.opacity = opacity;
    }
    draw(ctx, geom, z, feature) {
        const pt = geom[0]?.[0];
        if (!pt) return;
        const { x, y } = pt;
        const s = this.size;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.87, y + s * 0.5);
        ctx.lineTo(x - s * 0.87, y + s * 0.5);
        ctx.closePath();
        ctx.fillStyle = this.fill;
        ctx.fill();
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
        ctx.restore();
    }
}

// ── Base tile layer ──
function BaseTileLayer({ tileLayer }) {
    const map = useMap();
    const tileRef = useRef(null);

    useEffect(() => {
        if (tileRef.current) map.removeLayer(tileRef.current);
        const L = window.L;
        const url = TILES[tileLayer] || TILES.dark;
        const layer = L.tileLayer(url, { maxZoom: 19 });
        layer.addTo(map);
        tileRef.current = layer;
        return () => { if (tileRef.current) map.removeLayer(tileRef.current); };
    }, [tileLayer, map]);

    return null;
}

// ── PMTiles overlay — rebuilds on tile theme, layer toggle, or energize change ──
function PMTilesOverlay({ tileLayer, layers, energized }) {
    const map = useMap();
    const layerRef = useRef(null);

    // Serialize layers to a string so we can use it as an effect dependency
    const layerKey = JSON.stringify(layers);

    useEffect(() => {
        if (layerRef.current) map.removeLayer(layerRef.current);

        const theme = tileLayer || 'dark';
        const tiers = VOLTAGE_TIERS_BY_THEME[theme] || VOLTAGE_TIERS_BY_THEME.dark;
        const mk = MARKER_THEMES[theme] || MARKER_THEMES.dark;

        const showLines = layers?.lines ?? true;
        const showCables = layers?.cables ?? true;
        const showTowers = layers?.towers ?? false;
        const showSubstations = layers?.substations ?? true;

        try {
            const paintRules = [];

            // Line paint rules (one per voltage tier) — only if lines toggle on
            if (showLines) {
                if (energized) {
                    tiers.forEach((tier, tierIdx) => {
                        paintRules.push({
                            dataLayer: 'grid',
                            symbolizer: new LineSymbolizer({
                                color: tier.color,
                                width: tier.width,
                                opacity: 0.9,
                            }),
                            filter: (zoom, feature) => {
                                if (feature?.props?.type !== 'Line') return false;
                                return getVoltageTierIndex(feature?.props?.voltage || '', tiers) === tierIdx;
                            },
                        });
                    });
                } else {
                    // De-energized: single grey rule for all lines
                    paintRules.push({
                        dataLayer: 'grid',
                        symbolizer: new LineSymbolizer({
                            color: '#555555',
                            width: 1,
                            opacity: 0.4,
                        }),
                        filter: (zoom, feature) => feature?.props?.type === 'Line',
                    });
                }
            }

            // Cable paint rules — separate toggle
            if (showCables) {
                if (energized) {
                    tiers.forEach((tier, tierIdx) => {
                        paintRules.push({
                            dataLayer: 'grid',
                            symbolizer: new LineSymbolizer({
                                color: tier.color,
                                width: tier.width * 0.8,
                                opacity: 0.75,
                                dash: [6, 3],
                            }),
                            filter: (zoom, feature) => {
                                if (feature?.props?.type !== 'Cable') return false;
                                return getVoltageTierIndex(feature?.props?.voltage || '', tiers) === tierIdx;
                            },
                        });
                    });
                } else {
                    paintRules.push({
                        dataLayer: 'grid',
                        symbolizer: new LineSymbolizer({
                            color: '#555555',
                            width: 0.8,
                            opacity: 0.3,
                            dash: [6, 3],
                        }),
                        filter: (zoom, feature) => feature?.props?.type === 'Cable',
                    });
                }
            }

            // Substations — diamond
            if (showSubstations) {
                const subOpacity = energized ? 0.95 : 0.35;
                paintRules.push({
                    dataLayer: 'grid',
                    symbolizer: new DiamondSymbolizer({
                        size: 6,
                        fill: energized ? mk.subFill : '#666',
                        stroke: energized ? mk.subStroke : '#444',
                        dotFill: energized ? mk.subDot : '#444',
                        strokeWidth: theme === 'satellite' ? 2 : 1.5,
                        opacity: subOpacity,
                    }),
                    filter: (zoom, feature) => {
                        const t = feature?.props?.type;
                        return t === 'Substation_Icon' || t === 'Substation_Area';
                    },
                });
            }

            // Towers — triangle at zoom ≥ 9
            if (showTowers) {
                const twrOpacity = energized
                    ? (theme === 'satellite' ? 0.8 : 0.65)
                    : 0.25;
                paintRules.push({
                    dataLayer: 'grid',
                    symbolizer: new TriangleSymbolizer({
                        size: 3,
                        fill: energized ? mk.towerFill : '#555',
                        stroke: energized ? mk.towerStroke : '#444',
                        strokeWidth: theme === 'satellite' ? 1 : 0.5,
                        opacity: twrOpacity,
                    }),
                    filter: (zoom, feature) => {
                        return zoom >= 9 && feature?.props?.type === 'Tower';
                    },
                });
            }

            // If no rules, add a no-op to avoid empty layer
            if (paintRules.length === 0) {
                paintRules.push({
                    dataLayer: 'grid',
                    symbolizer: new LineSymbolizer({ color: 'transparent', width: 0, opacity: 0 }),
                    filter: () => false,
                });
            }

            const layer = leafletLayer({
                url: '/india_grid.pmtiles',
                paintRules,
                labelRules: [],
                maxDataZoom: 15,
            });

            layer.addTo(map);
            layerRef.current = layer;
        } catch (err) {
            console.error('PMTiles layer error:', err);
        }

        return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
    }, [map, tileLayer, layerKey, energized]);

    return null;
}

export default function MapView({ tileLayer, layers, energized }) {
    const theme = tileLayer || 'dark';
    const tiers = VOLTAGE_TIERS_BY_THEME[theme] || VOLTAGE_TIERS_BY_THEME.dark;
    const mk = MARKER_THEMES[theme] || MARKER_THEMES.dark;
    const lg = LEGEND_THEMES[theme] || LEGEND_THEMES.dark;

    return (
        <div className="map-container">
            <MapContainer
                center={[22.5, 78.5]}
                zoom={5}
                style={{ width: '100%', height: '100%' }}
                preferCanvas={true}
            >
                <BaseTileLayer tileLayer={tileLayer} />
                <PMTilesOverlay tileLayer={tileLayer} layers={layers} energized={energized} />
            </MapContainer>

            {/* Legend — professional utility-map index */}
            <div
                className="map-legend"
                style={{
                    background: lg.bg,
                    color: lg.text,
                    borderColor: lg.border,
                }}
            >
                {/* ── VOLTAGE CLASS ── */}
                <div className="legend-section-header" style={{ color: lg.titleColor }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    Voltage Class
                </div>
                {tiers.map(({ label, color }) => (
                    <div key={label} className="legend-row">
                        <div className="legend-swatch" style={{ background: color }} />
                        <span className="legend-label" style={{ color: lg.text }}>{label}</span>
                    </div>
                ))}

                {/* ── INFRASTRUCTURE ── */}
                <div className="legend-section-header" style={{ color: lg.titleColor }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>
                    Infrastructure
                </div>

                {/* Substation — diamond */}
                <div className="legend-row">
                    <div className="legend-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <polygon points="8,1 15,8 8,15 1,8" fill={mk.subFill} stroke={mk.subStroke} strokeWidth="1.5" />
                            <circle cx="8" cy="8" r="1.8" fill={mk.subDot} />
                        </svg>
                    </div>
                    <span className="legend-label" style={{ color: lg.text }}>Substation</span>
                </div>

                {/* Tower — triangle */}
                <div className="legend-row">
                    <div className="legend-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <polygon points="8,2 14,13 2,13" fill={mk.towerFill} stroke={mk.towerStroke} strokeWidth="0.8" />
                        </svg>
                    </div>
                    <span className="legend-label" style={{ color: lg.text }}>Tower&ensp;<span style={{ fontSize: 9, opacity: 0.5 }}>z≥9</span></span>
                </div>

                {/* Cable — dashed line */}
                <div className="legend-row">
                    <div className="legend-icon">
                        <svg width="16" height="4" viewBox="0 0 16 4">
                            <line x1="0" y1="2" x2="16" y2="2" stroke={lg.text} strokeWidth="2" strokeDasharray="4 2" opacity="0.55" />
                        </svg>
                    </div>
                    <span className="legend-label" style={{ color: lg.text }}>Cable (underground)</span>
                </div>
            </div>
        </div>
    );
}
