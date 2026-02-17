import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, CircleMarker, Polyline, Tooltip, Rectangle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TILES = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attr: '&copy; CartoDB'
    },
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attr: '&copy; CartoDB'
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: '&copy; Esri'
    }
};

const VOLTAGE_COLORS = {
    800: '#FF1A66',    // Bright pink-red for highest voltage
    765: '#FF2E7A',    // Bright pink
    400: '#FF7A00',    // Bright orange
    345: '#FFA500',    // Orange
    230: '#FFD700',    // Gold
    220: '#FFEB3B',    // Bright yellow
    132: '#76FF03',    // Bright lime
    110: '#00FF88',    // Bright green
    66: '#00D4FF',     // Bright cyan
    33: '#3D8BFF',     // Bright blue
    22: '#9C4DFF',     // Bright purple
    11: '#D946FF',     // Bright magenta
};

function getVoltageColor(kv) {
    if (kv >= 765) return VOLTAGE_COLORS[765];
    if (kv >= 400) return VOLTAGE_COLORS[400];
    if (kv >= 220) return VOLTAGE_COLORS[220];
    if (kv >= 132) return VOLTAGE_COLORS[132];
    if (kv >= 110) return VOLTAGE_COLORS[110];
    if (kv >= 66) return VOLTAGE_COLORS[66];
    if (kv >= 33) return VOLTAGE_COLORS[33];
    if (kv >= 22) return VOLTAGE_COLORS[22];
    if (kv >= 11) return VOLTAGE_COLORS[11];
    return '#666666';
}

// Component to dynamically change tile layer
function TileLayerSwitcher({ tileLayer }) {
    const map = useMap();
    const tileRef = useRef(null);

    useEffect(() => {
        if (tileRef.current) {
            map.removeLayer(tileRef.current);
        }
        const L = window.L || require('leaflet');
        const tileConfig = TILES[tileLayer] || TILES.dark;
        const layer = L.tileLayer(tileConfig.url, {
            attribution: tileConfig.attr,
            maxZoom: 19,
        });
        layer.addTo(map);
        tileRef.current = layer;

        return () => {
            if (tileRef.current) map.removeLayer(tileRef.current);
        };
    }, [tileLayer, map]);

    return null;
}

// Render transmission lines with enhanced visibility
function LineLayer({ gridData, simState, busGeoMap, isolateFault, onTriggerFault }) {
    const { energized, energizedStatus, faultInfo } = simState;
    const [isFaultAnimating, setIsFaultAnimating] = React.useState(false);

    // Animate fault lines
    React.useEffect(() => {
        if (faultInfo) {
            setIsFaultAnimating(true);
            const interval = setInterval(() => {
                setIsFaultAnimating(prev => !prev);
            }, 600);
            return () => clearInterval(interval);
        } else {
            setIsFaultAnimating(false);
        }
    }, [faultInfo]);

    return useMemo(() => {
        if (!gridData) return null;
        const lines = gridData.lines;
        const elements = [];

        for (let i = 0; i < lines.length; i++) {
            // Handle both 4-element and 5-element line arrays
            // Format: [id, source, target, voltage, name?]
            const line = lines[i];
            const idx = line[0];
            const fromBus = line[1];
            const toBus = line[2];
            const kv = line[3] || 0; // Default to 0 if voltage is missing/null
            const fromGeo = busGeoMap.get(fromBus);
            const toGeo = busGeoMap.get(toBus);
            if (!fromGeo || !toGeo) continue;

            const isFaulted = faultInfo && faultInfo.lineIdx === idx;
            // When energized, check if buses are live
            // If energizedStatus exists, use it; otherwise if energized is true, assume buses are live
            let fromLive = 0;
            let toLive = 0;
            if (energized) {
                if (energizedStatus) {
                    fromLive = energizedStatus.get(fromBus) || 0;
                    toLive = energizedStatus.get(toBus) || 0;
                } else {
                    // Energized but no status yet - assume all are live
                    fromLive = 1;
                    toLive = 1;
                }
            }
            const isAffected = energized && faultInfo && !isFaulted && (!fromLive || !toLive);

            // If isolation mode is on, only show faulted and affected lines
            if (isolateFault && !isFaulted && !isAffected) continue;

            let color = '#555';
            let weight = 2.5;
            let opacity = 0.7;
            let dashArray = null;
            let className = '';

            if (isFaulted) {
                // Enhanced fault visualization with pulsing effect
                color = isFaultAnimating ? '#FF0000' : '#FF4444';
                weight = 5;
                opacity = 1;
                dashArray = '10 5';
                className = 'fault-line';
            } else if (isAffected) {
                // Affected lines - de-energized due to fault
                color = '#FF6D00'; // Orange to show affected status
                weight = 3;
                opacity = 0.8;
                dashArray = '5 3';
                className = 'affected-line';
            } else if (energized) {
                // When energized, show voltage-based colors if both buses are live
                if (fromLive && toLive) {
                    // Ensure kv is a number and > 0
                    const voltage = typeof kv === 'number' ? kv : parseFloat(kv) || 0;
                    if (voltage > 0) {
                        color = getVoltageColor(voltage);
                        // Increased weight for better visibility
                        weight = voltage >= 400 ? 3.5 : voltage >= 220 ? 3 : 2.5;
                        opacity = 0.85;
                    } else {
                        // Voltage unknown/zero - use a default energized color
                        color = '#00FF88'; // Bright green for energized but unknown voltage
                        weight = 2.5;
                        opacity = 0.85;
                    }
                } else if (!fromLive && !toLive) {
                    // Both buses are dead - show as de-energized
                    color = '#3a3a3a';
                    weight = 2;
                    opacity = 0.5;
                } else {
                    // One bus live, one dead - show as partially energized (shouldn't happen normally)
                    color = '#FFA500'; // Orange for partial
                    weight = 2.5;
                    opacity = 0.7;
                }
            } else {
                // Default state (not energized) - show in gray
                color = '#555';
                weight = 2.5;
                opacity = 0.7;
            }

            elements.push(
                <Polyline
                    key={idx}
                    positions={[[fromGeo[1], fromGeo[0]], [toGeo[1], toGeo[0]]]}
                    pathOptions={{ color, weight, opacity, dashArray, className }}
                    eventHandlers={{
                        click: () => {
                            if (onTriggerFault) onTriggerFault(idx);
                        }
                    }}
                >
                    <Tooltip sticky>
                        <div style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                            <strong>Line {idx}</strong><br />
                            {isFaulted ? (
                                <span style={{ color: '#FF1744' }}>⚠️ FAULTED</span>
                            ) : isAffected ? (
                                <span style={{ color: '#FF6D00' }}>⚡ AFFECTED (De-energized)</span>
                            ) : (
                                <span>{kv > 0 ? `${kv} kV` : 'Voltage Unknown'}</span>
                            )}
                            <br />
                            Bus {fromBus} ➝ Bus {toBus}
                            {!isFaulted && !isAffected && <div style={{ marginTop: 4, fontSize: 10, color: '#aaa' }}>(Click to fault)</div>}
                        </div>
                    </Tooltip>
                </Polyline>
            );
        }

        return <>{elements}</>;
    }, [gridData, energized, energizedStatus, faultInfo, busGeoMap, isolateFault, onTriggerFault, isFaultAnimating]);
}

// Render tower markers with zoom-based visibility
function TowerLayer({ gridData }) {
    const map = useMap();
    const [zoom, setZoom] = React.useState(map.getZoom());
    const TOWER_VISIBILITY_THRESHOLD = 9; // Towers visible at zoom level 9+

    React.useEffect(() => {
        const handleZoom = () => {
            setZoom(map.getZoom());
        };
        map.on('zoomend', handleZoom);
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map]);

    if (!gridData || !gridData.towers || zoom < TOWER_VISIBILITY_THRESHOLD) return null;

    // Performance optimization: sample towers at lower zoom levels
    const sampleRate = zoom >= 12 ? 1 : zoom >= 10 ? 2 : 4;

    return (
        <>
            {gridData.towers.filter((_, i) => i % sampleRate === 0).map(([lon, lat], i) => (
                <CircleMarker
                    key={`t${i * sampleRate}`}
                    center={[lat, lon]}
                    radius={zoom >= 12 ? 4 : 3}
                    pathOptions={{
                        color: '#777',
                        fillColor: '#999',
                        fillOpacity: 0.7,
                        weight: 1
                    }}
                >
                    <Tooltip>
                        Tower<br />
                        {lat.toFixed(4)}, {lon.toFixed(4)}
                    </Tooltip>
                </CircleMarker>
            ))}
        </>
    );
}

// Render pole markers with zoom-based visibility
function PoleLayer({ gridData }) {
    const map = useMap();
    const [zoom, setZoom] = React.useState(map.getZoom());
    const POLE_VISIBILITY_THRESHOLD = 10; // Poles visible at zoom level 10+

    React.useEffect(() => {
        const handleZoom = () => {
            setZoom(map.getZoom());
        };
        map.on('zoomend', handleZoom);
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map]);

    if (!gridData || !gridData.poles || zoom < POLE_VISIBILITY_THRESHOLD) return null;

    // Performance optimization: sample poles at lower zoom levels
    const sampleRate = zoom >= 13 ? 1 : zoom >= 11 ? 3 : 5;

    return (
        <>
            {gridData.poles.filter((_, i) => i % sampleRate === 0).map(([lon, lat], i) => (
                <CircleMarker
                    key={`p${i * sampleRate}`}
                    center={[lat, lon]}
                    radius={zoom >= 13 ? 3 : 2}
                    pathOptions={{
                        color: '#888',
                        fillColor: '#aaa',
                        fillOpacity: 0.7,
                        weight: 1
                    }}
                >
                    <Tooltip>
                        Pole<br />
                        {lat.toFixed(4)}, {lon.toFixed(4)}
                    </Tooltip>
                </CircleMarker>
            ))}
        </>
    );
}

// Render substations
function SubstationLayer({ gridData }) {
    if (!gridData || !gridData.substations) return null;
    return (
        <>
            {gridData.substations.map(([lon, lat, voltage, name], i) => (
                <CircleMarker
                    key={`s${i}`}
                    center={[lat, lon]}
                    radius={3}
                    pathOptions={{ color: '#888', fillColor: '#DDD', fillOpacity: 0.8, weight: 1 }}
                >
                    {name && (
                        <Tooltip>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px' }}>
                                <strong>{name}</strong><br />
                                {voltage ? `${voltage}` : 'Unknown Voltage'}
                            </div>
                        </Tooltip>
                    )}
                </CircleMarker>
            ))}
        </>
    );
}

// Render sensor markers
function SensorLayer({ simState, busGeoMap }) {
    const { sensors, sensorReadings } = simState;
    if (!sensors || sensors.length === 0) return null;

    return (
        <>
            {sensors.map((busId, i) => {
                const geo = busGeoMap.get(busId);
                if (!geo) return null;
                // If sensorReadings exists, use it; otherwise if sensors are placed but no readings yet, assume live
                const isLive = sensorReadings
                    ? (sensorReadings.get(busId) || 0) === 1
                    : true; // Default to live if no readings available
                const color = isLive ? '#00E676' : '#FF1744';

                return (
                    <CircleMarker
                        key={`sen${i}`}
                        center={[geo[1], geo[0]]}
                        radius={5}
                        pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.9,
                            weight: 2,
                        }}
                    >
                        <Tooltip>Sensor S{i + 1} | Bus {busId} | {isLive ? 'LIVE' : 'DEAD'}</Tooltip>
                    </CircleMarker>
                );
            })}
        </>
    );
}

// Render power source marker
function SourceMarker({ gridData, busGeoMap }) {
    if (!gridData) return null;
    const geo = busGeoMap.get(gridData.ext_grid_bus);
    if (!geo) return null;

    return (
        <CircleMarker
            center={[geo[1], geo[0]]}
            radius={6}
            pathOptions={{
                color: '#E040FB',
                fillColor: '#E040FB',
                fillOpacity: 1,
                weight: 2,
            }}
        >
            <Tooltip>Power Source (Bus {gridData.ext_grid_bus})</Tooltip>
        </CircleMarker>
    );
}

// Component to track zoom level
function ZoomTracker({ onZoomChange }) {
    const map = useMap();

    useEffect(() => {
        const handleZoom = () => {
            onZoomChange(map.getZoom());
        };
        handleZoom(); // Initial call
        map.on('zoomend', handleZoom);
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map, onZoomChange]);

    return null;
}

// Component for area selection using rectangle drawing
function AreaSelector({ isSelecting, onAreaSelected, onSelectionCancel }) {
    const map = useMap();
    const [startPoint, setStartPoint] = React.useState(null);
    const [endPoint, setEndPoint] = React.useState(null);
    const rectangleRef = React.useRef(null);

    useMapEvents({
        mousedown(e) {
            if (!isSelecting || !onAreaSelected) return;
            const { lat, lng } = e.latlng;
            setStartPoint([lat, lng]);
            setEndPoint([lat, lng]);
        },
        mousemove(e) {
            if (!isSelecting || !startPoint) return;
            const { lat, lng } = e.latlng;
            setEndPoint([lat, lng]);
        },
        mouseup(e) {
            if (!isSelecting || !startPoint || !endPoint || !onAreaSelected) return;
            const bounds = [
                [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
                [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
            ];
            
            // Convert bounds to API format (min_lon, min_lat, max_lon, max_lat)
            const regionBounds = {
                min_lon: bounds[0][1],
                min_lat: bounds[0][0],
                max_lon: bounds[1][1],
                max_lat: bounds[1][0]
            };
            
            onAreaSelected(regionBounds);
            setStartPoint(null);
            setEndPoint(null);
        }
    });

    useEffect(() => {
        if (isSelecting && onAreaSelected) {
            map.getContainer().style.cursor = 'crosshair';
            if (map.dragging) {
                map.dragging.disable();
            }
        } else {
            map.getContainer().style.cursor = '';
            if (map.dragging) {
                map.dragging.enable();
            }
            setStartPoint(null);
            setEndPoint(null);
        }
        return () => {
            map.getContainer().style.cursor = '';
            if (map.dragging) {
                map.dragging.enable();
            }
        };
    }, [isSelecting, map, onAreaSelected]);

    if (!isSelecting || !onAreaSelected || !startPoint || !endPoint) return null;

    const bounds = [
        [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
        [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
    ];

    return (
        <Rectangle
            ref={rectangleRef}
            bounds={bounds}
            pathOptions={{
                color: '#00D4FF',
                fillColor: '#00D4FF',
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '5, 5'
            }}
        />
    );
}

// Persistent overlay showing the last selected area
function SelectedAreaOverlay({ bounds }) {
    if (!bounds) return null;

    // bounds is { min_lon, min_lat, max_lon, max_lat }
    const leafletBounds = [
        [bounds.min_lat, bounds.min_lon],
        [bounds.max_lat, bounds.max_lon],
    ];

    return (
        <Rectangle
            bounds={leafletBounds}
            pathOptions={{
                color: '#00D4FF',
                fillColor: '#00D4FF',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '4, 4',
            }}
        />
    );
}

export default function MapView({
    gridData,
    simState,
    layers,
    tileLayer,
    isolateFault,
    onTriggerFault,
    isSelectingArea,
    onAreaSelected,
    onSelectionCancel,
    showEmptyWhenNoData = false,
    selectedAreaBounds,
}) {
    const [currentZoom, setCurrentZoom] = React.useState(5);

    // Build bus geo lookup
    const busGeoMap = useMemo(() => {
        const m = new Map();
        if (gridData) {
            for (const [id, lon, lat] of gridData.buses) {
                m.set(id, [lon, lat]);
            }
        }
        return m;
    }, [gridData]);

    // Default center on India
    const center = useMemo(() => {
        if (gridData && gridData.buses.length > 0) {
            let sumLat = 0, sumLon = 0, count = 0;
            // Sample 500 buses for center
            const step = Math.max(1, Math.floor(gridData.buses.length / 500));
            for (let i = 0; i < gridData.buses.length; i += step) {
                sumLon += gridData.buses[i][1];
                sumLat += gridData.buses[i][2];
                count++;
            }
            return [sumLat / count, sumLon / count];
        }
        return [22.5, 78.5]; // India center
    }, [gridData]);

    if (!gridData) {
        if (showEmptyWhenNoData) {
            // Show empty basemap (for SimulationPage before an area is selected)
            return (
                <div className="map-container">
                    <MapContainer
                        center={[22.5, 78.5]} // India center
                        zoom={5}
                        style={{ width: '100%', height: '100%' }}
                        preferCanvas={true}
                        zoomControl={true}
                    >
                        <TileLayerSwitcher tileLayer={tileLayer} />
                        <ZoomTracker onZoomChange={setCurrentZoom} />
                        {selectedAreaBounds && (
                            <SelectedAreaOverlay bounds={selectedAreaBounds} />
                        )}
                        {isSelectingArea && onAreaSelected && (
                            <AreaSelector
                                isSelecting={isSelectingArea}
                                onAreaSelected={onAreaSelected}
                                onSelectionCancel={onSelectionCancel}
                            />
                        )}
                    </MapContainer>
                </div>
            );
        }

        // Default behavior (used by Dashboard): show loading state while data is fetched
        return (
            <div className="map-container">
                <div className="map-loading">
                    <div className="spinner" />
                    <div className="text">Loading grid data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="map-container">
            <MapContainer
                center={center}
                zoom={5}
                style={{ width: '100%', height: '100%' }}
                preferCanvas={true}
                zoomControl={true}
            >
                <TileLayerSwitcher tileLayer={tileLayer} />
                <ZoomTracker onZoomChange={setCurrentZoom} />
                {selectedAreaBounds && (
                    <SelectedAreaOverlay bounds={selectedAreaBounds} />
                )}
                {isSelectingArea && onAreaSelected && (
                    <AreaSelector 
                        isSelecting={isSelectingArea} 
                        onAreaSelected={onAreaSelected}
                        onSelectionCancel={onSelectionCancel}
                    />
                )}

                {layers.lines && (
                    <LineLayer
                        gridData={gridData}
                        simState={simState}
                        busGeoMap={busGeoMap}
                        isolateFault={isolateFault}
                        onTriggerFault={onTriggerFault}
                    />
                )}
                {layers.towers && <TowerLayer gridData={gridData} />}
                {layers.poles && <PoleLayer gridData={gridData} />}
                {layers.substations && <SubstationLayer gridData={gridData} />}
                {layers.sensors && <SensorLayer simState={simState} busGeoMap={busGeoMap} />}
                {layers.source && <SourceMarker gridData={gridData} busGeoMap={busGeoMap} />}
            </MapContainer>

            {/* Zoom level indicator */}
            {(layers.poles || layers.towers) && (
                <div className="zoom-indicator">
                    <div className="zoom-level">Zoom: {currentZoom.toFixed(1)}</div>
                    {layers.towers && currentZoom < 9 && (
                        <div className="zoom-hint">🔍 Zoom in to see towers (9+)</div>
                    )}
                    {layers.poles && currentZoom < 10 && (
                        <div className="zoom-hint">🔍 Zoom in to see poles (10+)</div>
                    )}
                </div>
            )}

            {/* Voltage Legend */}
            <div className="map-legend">
                <div className="legend-title">Voltage Levels</div>
                {[
                    ['765+ kV', '#FF2E7A'],
                    ['400 kV', '#FF7A00'],
                    ['220 kV', '#FFEB3B'],
                    ['132 kV', '#76FF03'],
                    ['110 kV', '#00FF88'],
                    ['66 kV', '#00D4FF'],
                    ['33 kV', '#3D8BFF'],
                    ['11 kV', '#D946FF'],
                ].map(([label, color]) => (
                    <div key={label} className="legend-item">
                        <div className="legend-line" style={{ background: color }} />
                        <span>{label}</span>
                    </div>
                ))}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }} />
                <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#00E676' }} />
                    <span>Sensor Live</span>
                </div>
                <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#FF1744' }} />
                    <span>Sensor Dead</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line fault-indicator" style={{
                        background: '#FF0000',
                        height: 3,
                        backgroundImage: 'repeating-linear-gradient(90deg, #FF0000 0px, #FF0000 10px, transparent 10px, transparent 15px)',
                        boxShadow: '0 0 8px #FF0000'
                    }} />
                    <span>⚠️ Fault</span>
                </div>
            </div>
        </div>
    );
}
