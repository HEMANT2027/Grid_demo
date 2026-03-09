import { useState, useEffect, useCallback, useRef } from 'react';
import StatusBar from '../components/StatusBar';
import ControlPanel from '../components/ControlPanel';
import MapView from '../components/MapView';
import SensorPanel from '../components/SensorPanel';
import { buildAdjacencyList, getEnergizedStatus } from '../simulation/gridEngine';
import { placeSensorsIntervalBased, readSensors, identifyFaultyInterval } from '../simulation/sensorEngine';
import '../index.css';

const INITIAL_SIM_STATE = {
    energized: false,
    sensors: [],
    intervals: [],
    sensorMetrics: null,
    sensorReadings: null,
    energizedStatus: null,
    initialEnergizedStatus: null, // Store initial state to filter dead-from-start wires
    faultInfo: null,
    faultyInterval: -1,
    repairMode: false,
};

const INITIAL_LAYERS = {
    lines: true,
    towers: false,
    poles: false,
    substations: true,
    sensors: true,
    source: true,
};

export default function SimulationPage() {
    const [gridData, setGridData] = useState(null);
    const [simState, setSimState] = useState(INITIAL_SIM_STATE);
    const [layers, setLayers] = useState(INITIAL_LAYERS);
    const [tileLayer, setTileLayer] = useState('dark');
    const [isolateFault, setIsolateFault] = useState(false);
    const [toast, setToast] = useState(null);
    const [sources, setSources] = useState([]);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectedAreaBounds, setSelectedAreaBounds] = useState(null);
    const [sensorInterval, setSensorInterval] = useState(50); // L = 50 poles
    const adjRef = useRef(null);
    const allBusesRef = useRef([]);

    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Export traversal log to file
    const handleExportTraversalLog = useCallback(() => {
        if (!simState.sensorMetrics || !simState.sensorMetrics.traversalLog) {
            showToast('⚠️ No traversal log available. Place sensors first.');
            return;
        }

        const log = simState.sensorMetrics.traversalLog.join('\n');
        const blob = new Blob([log], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sensor_traversal_log.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('📄 Traversal log exported!');
    }, [simState.sensorMetrics, showToast]);

    // Load grid data from PostgreSQL via API based on selected area
    const loadGridData = useCallback((regionBounds) => {
        // Use proxy in development, or direct URL in production
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        
        // Build query string from selected bounds or default to a specific region to prevent loading all of India
        let queryString = '?region=delhi'; // Default to Delhi to save load time
        if (regionBounds) {
            queryString = `?min_lon=${regionBounds.min_lon}&min_lat=${regionBounds.min_lat}&max_lon=${regionBounds.max_lon}&max_lat=${regionBounds.max_lat}`;
        }
        
        fetch(`${apiUrl}/grid-data${queryString}`)
            .then(r => {
                if (!r.ok) {
                    throw new Error(`HTTP error! status: ${r.status}`);
                }
                return r.json();
            })
            .then(data => {
                setGridData(data);
                // Build adjacency list
                adjRef.current = buildAdjacencyList(data.lines);
                allBusesRef.current = data.buses.map(b => b[0]);

                // Use ONLY substation sources as power sources
                const substationSources = data.substation_sources || [];
                setSources(substationSources);
                
                console.log(`Using ${substationSources.length} substation sources as power sources`);

                const regionName = regionBounds ? 'selected area' : 'full grid';
                if (substationSources.length > 0) {
                    showToast(`Grid loaded (${regionName}): ${data.stats.total_buses.toLocaleString()} buses, ${data.stats.total_lines.toLocaleString()} lines, ${substationSources.length} substations.`);
                } else {
                    showToast(`⚠️ Grid loaded but no substations found! Energization will not work.`);
                }
            })
            .catch(err => {
                console.error('Failed to load grid data:', err);
                showToast(`Failed to load grid data! Make sure the API server is running. Error: ${err.message}`);
            });
    }, [showToast]);

    // Reload data when area selection changes
    useEffect(() => {
        if (selectedAreaBounds) {
            // Reset simulation state when area changes
            setSimState(INITIAL_SIM_STATE);
            setIsolateFault(false);
            // Load new data
            loadGridData(selectedAreaBounds);
        }
    }, [selectedAreaBounds, loadGridData]);

    // ── SIMULATION ACTIONS ──

    const handleEnergize = useCallback(() => {
        if (!adjRef.current || !gridData) return;

        // We now use the computed 'sources' which includes virtual sources for all components
        if (sources.length === 0) {
            showToast('⚠️ Error: No sources identified');
            return;
        }

        const t0 = performance.now();
        const disabled = new Set();
        const status = getEnergizedStatus(adjRef.current, sources, disabled, allBusesRef.current);
        const elapsed = (performance.now() - t0).toFixed(0);

        let live = 0;
        status.forEach(v => { if (v === 1) live++; });

        setSimState(prev => ({
            ...prev,
            energized: true,
            energizedStatus: status,
            initialEnergizedStatus: prev.initialEnergizedStatus || status, // Store initial state only once
            faultInfo: null,
            faultyInterval: -1,
            sensorReadings: prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null,
        }));

        showToast(`⚡ Energized in ${elapsed}ms — ${live.toLocaleString()} buses live`);
    }, [gridData, sources, showToast]);

    const handleDeenergize = useCallback(() => {
        setSimState(prev => ({
            ...prev,
            energized: false,
            energizedStatus: null,
            faultInfo: null,
            faultyBlock: -1,
            sensorReadings: null,
        }));
        showToast('Grid de-energized');
    }, [showToast]);

    const handlePlaceSensors = useCallback(() => {
        if (!gridData) return;
        
        // Check if grid is energized first
        if (!simState.energized || !simState.energizedStatus) {
            showToast('⚠️ Please energize the grid first before placing sensors');
            return;
        }
        
        const t0 = performance.now();
        
        // Build bus geography map
        const busGeoMap = new Map();
        for (const [id, lon, lat] of gridData.buses) {
            busGeoMap.set(id, [lon, lat]);
        }
        
        // Use poles/towers for sensor placement
        const poles = gridData.towers && gridData.towers.length > 0 
            ? gridData.towers 
            : gridData.poles || [];
        
        if (poles.length === 0) {
            showToast('⚠️ No poles/towers found for sensor placement');
            return;
        }
        
        // Place sensors using interval-based sampling with strategic placement
        const result = placeSensorsIntervalBased(
            poles, 
            busGeoMap, 
            sensorInterval,
            adjRef.current,  // Pass adjacency list for DFS
            sources,         // Pass power sources
            gridData.substations || [],  // Pass substations
            simState.energizedStatus  // Pass energized status to filter paths
        );
        
        // Filter out sensors on non-energized buses
        const energizedSensors = [];
        const energizedIntervals = [];
        
        for (let i = 0; i < result.sensors.length; i++) {
            const busId = result.sensors[i];
            const isEnergized = simState.energizedStatus.get(busId) === 1;
            
            if (isEnergized) {
                energizedSensors.push(busId);
                energizedIntervals.push(result.intervals[i]);
            }
        }
        
        const elapsed = (performance.now() - t0).toFixed(0);
        
        if (energizedSensors.length === 0) {
            showToast('⚠️ No energized buses found near poles for sensor placement');
            return;
        }

        // Recalculate metrics for filtered sensors
        const filteredMetrics = {
            ...result.metrics,
            sensorsPlaced: energizedSensors.length,
            systemResolution: result.metrics.totalPoles / energizedSensors.length,
            originalSensors: result.sensors.length,
            filteredOut: result.sensors.length - energizedSensors.length
        };

        setSimState(prev => {
            const readings = readSensors(energizedSensors, prev.energizedStatus);
            return { 
                ...prev, 
                sensors: energizedSensors, 
                intervals: energizedIntervals,
                sensorMetrics: filteredMetrics,
                sensorReadings: readings 
            };
        });

        const strategicMsg = result.metrics.strategicSensors > 0 
            ? ` (${result.metrics.strategicSensors} strategic + ${result.metrics.intervalSensors} interval)` 
            : '';
        const filteredMsg = filteredMetrics.filteredOut > 0 
            ? ` [${filteredMetrics.filteredOut} non-energized filtered]` 
            : '';
        showToast(`📡 ${energizedSensors.length} sensors placed in ${elapsed}ms${strategicMsg}${filteredMsg}`);
    }, [gridData, sensorInterval, simState.energized, simState.energizedStatus, sources, showToast]);

    const handleTriggerFault = useCallback((lineIdx) => {
        if (!adjRef.current || !gridData) return;
        
        // Only allow click-to-fault (lineIdx must be provided)
        if (lineIdx === undefined || lineIdx === null) {
            showToast('⚠️ Please click on a line to trigger a fault');
            return;
        }

        const t0 = performance.now();
        const line = gridData.lines.find(l => l[0] === lineIdx);
        const disabled = new Set([lineIdx]);
        const status = getEnergizedStatus(adjRef.current, sources, disabled, allBusesRef.current);

        const faultInfo = {
            lineIdx: lineIdx,
            fromBus: line ? line[1] : '?',
            toBus: line ? line[2] : '?',
            voltage: line ? line[3] : '?',
        };

        let deadCount = 0;
        status.forEach(v => { if (v === 0) deadCount++; });

        setSimState(prev => {
            const readings = prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null;
            const faultyInterval = readings
                ? identifyFaultyInterval(prev.sensors, readings) : -1;

            return {
                ...prev,
                energizedStatus: status,
                faultInfo,
                sensorReadings: readings,
                faultyInterval,
            };
        });

        const elapsed = (performance.now() - t0).toFixed(0);
        showToast(`💥 Fault on line ${lineIdx} — ${deadCount.toLocaleString()} buses dead (${elapsed}ms)`);
    }, [gridData, sources, showToast]);

    const handleRepairFault = useCallback(() => {
        if (!adjRef.current || !gridData) return;
        const t0 = performance.now();

        // Recalculate status without any faults
        const disabled = new Set();
        const status = getEnergizedStatus(adjRef.current, sources, disabled, allBusesRef.current);
        const elapsed = (performance.now() - t0).toFixed(0);

        setSimState(prev => ({
            ...prev,
            energized: true,
            energizedStatus: status,
            faultInfo: null,
            faultyBlock: -1,
            sensorReadings: prev.sensors.length > 0
                ? readSensors(prev.sensors, status) : null,
        }));

        showToast(`✅ Fault repaired in ${elapsed}ms — grid restored`);
    }, [gridData, sources, showToast]);

    const handleReset = useCallback(() => {
        setSimState(INITIAL_SIM_STATE);
        setIsolateFault(false);
        showToast('Simulation reset');
    }, [showToast]);

    const handleToggleLayer = useCallback((key) => {
        setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleToggleAreaSelection = useCallback(() => {
        setIsSelectingArea(prev => !prev);
    }, []);

    const handleAreaSelected = useCallback((bounds) => {
        setSelectedAreaBounds(bounds);
        setIsSelectingArea(false);
        showToast('Area selected! Loading grid data...');
    }, [showToast]);

    const handleSelectionCancel = useCallback(() => {
        setIsSelectingArea(false);
    }, []);

    return (
        <div className="app">
            <StatusBar gridData={gridData} simState={simState} />
            <div className="app-body">
                <ControlPanel
                    gridData={gridData}
                    simState={simState}
                    onEnergize={handleEnergize}
                    onDeenergize={handleDeenergize}
                    onPlaceSensors={handlePlaceSensors}
                    onRepairFault={handleRepairFault}
                    onReset={handleReset}
                    layers={layers}
                    onToggleLayer={handleToggleLayer}
                    tileLayer={tileLayer}
                    onChangeTile={setTileLayer}
                    isolateFault={isolateFault}
                    onToggleIsolateFault={() => setIsolateFault(prev => !prev)}
                    isSelectingArea={isSelectingArea}
                    onToggleAreaSelection={handleToggleAreaSelection}
                    sensorInterval={sensorInterval}
                    onChangeSensorInterval={setSensorInterval}
                    onExportTraversalLog={handleExportTraversalLog}
                />
                <MapView
                    gridData={gridData}
                    simState={simState}
                    layers={layers}
                    tileLayer={tileLayer}
                    isolateFault={isolateFault}
                    onTriggerFault={handleTriggerFault}
                    isSelectingArea={isSelectingArea}
                    onAreaSelected={handleAreaSelected}
                    onSelectionCancel={handleSelectionCancel}
                    showEmptyWhenNoData={true}
                    selectedAreaBounds={selectedAreaBounds}
                />
                <SensorPanel simState={simState} />
            </div>

            {/* Sensor Metrics Dashboard */}
            {simState.sensorMetrics && (
                <div className="metrics-dashboard">
                    <div className="metrics-title">Sensor System Metrics</div>
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <div className="metric-label">Total Poles (N)</div>
                            <div className="metric-value">{simState.sensorMetrics.totalPoles.toLocaleString()}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Sensors Placed (k)</div>
                            <div className="metric-value">{simState.sensorMetrics.sensorsPlaced.toLocaleString()}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Interval (L)</div>
                            <div className="metric-value">{simState.sensorMetrics.interval}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Duplicate Sensors</div>
                            <div className="metric-value">{simState.sensorMetrics.duplicateSensorsAtSubstations || 0}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">System Resolution (N/k)</div>
                            <div className="metric-value">{simState.sensorMetrics.systemResolution.toFixed(2)}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Max Span Gap</div>
                            <div className="metric-value">{(simState.sensorMetrics.maxSpanGap / 1000).toFixed(2)} km</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Avg Span Gap</div>
                            <div className="metric-value">{(simState.sensorMetrics.avgSpanGap / 1000).toFixed(2)} km</div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}