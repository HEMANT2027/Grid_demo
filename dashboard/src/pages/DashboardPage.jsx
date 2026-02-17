import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatusBar from '../components/StatusBar';
import ControlPanel from '../components/ControlPanel';
import MapView from '../components/MapView';
import SensorPanel from '../components/SensorPanel';
import { buildAdjacencyList, getEnergizedStatus, findGoodBridgeFault, findAllSources } from '../simulation/gridEngine';
import { placeSensorsSqrtN, readSensors, identifyFaultyBlock } from '../simulation/sensorEngine';
import '../index.css';

const INITIAL_SIM_STATE = {
  energized: false,
  sensors: [],
  blocks: [],
  sensorReadings: null,
  energizedStatus: null,
  faultInfo: null,
  faultyBlock: -1,
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

export default function DashboardPage() {
  const [gridData, setGridData] = useState(null);
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [tileLayer, setTileLayer] = useState('dark');
  const [isolateFault, setIsolateFault] = useState(false);
  const [toast, setToast] = useState(null);
  const [sources, setSources] = useState([]);
  const adjRef = useRef(null);
  const allBusesRef = useRef([]);

  // Load grid data from PostgreSQL via API 
  useEffect(() => {
    // Use proxy in development, or direct URL in production
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiUrl}/grid-data`)
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

        // Identify all connected components and assign virtual sources
        // This ensures the entire grid (even disconnected parts) can be energized
        const allSources = findAllSources(adjRef.current, allBusesRef.current, data.ext_grid_bus);
        setSources(allSources);

        showToast(`Grid loaded: ${data.stats.total_buses.toLocaleString()} buses, ${data.stats.total_lines.toLocaleString()} lines. Found ${allSources.length} sub-grids.`);
      })
      .catch(err => {
        console.error('Failed to load grid data:', err);
        showToast(`Failed to load grid data! Make sure the API server is running. Error: ${err.message}`);
      });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
      faultInfo: null,
      faultyBlock: -1,
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
    if (!adjRef.current || !gridData) return;
    const t0 = performance.now();
    // Pass 'sources' to ensure we traverse all components effectively
    const { sensors, blocks } = placeSensorsSqrtN(adjRef.current, sources, allBusesRef.current);
    const elapsed = (performance.now() - t0).toFixed(0);

    setSimState(prev => {
      const readings = prev.energizedStatus
        ? readSensors(sensors, prev.energizedStatus) : null;
      return { ...prev, sensors, blocks, sensorReadings: readings };
    });

    const expectedSensors = Math.ceil(Math.sqrt(allBusesRef.current.length));
    showToast(`📡 ${sensors.length} sensors placed in ${elapsed}ms (expected: √${allBusesRef.current.length.toLocaleString()} ≈ ${expectedSensors})`);
  }, [gridData, sources, showToast]);

  const handleTriggerFault = useCallback((lineIdx) => {
    if (!adjRef.current || !gridData) return;
    const t0 = performance.now();

    // If no specific line, pick random in-service line
    if (lineIdx === undefined || lineIdx === null) {
      lineIdx = Math.floor(Math.random() * gridData.lines.length);
    }

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
      const faultyBlock = readings
        ? identifyFaultyBlock(prev.sensors, readings) : -1;

      return {
        ...prev,
        energizedStatus: status,
        faultInfo,
        sensorReadings: readings,
        faultyBlock,
      };
    });

    // Auto-enable isolation if desired, or just keep previous state
    // setIsolateFault(true); 

    const elapsed = (performance.now() - t0).toFixed(0);
    showToast(`💥 Fault on line ${lineIdx} — ${deadCount.toLocaleString()} buses dead (${elapsed}ms)`);
  }, [gridData, sources, showToast]);

  const handleBridgeFault = useCallback(() => {
    if (!adjRef.current || !gridData) return;
    showToast('🔍 Searching for bridge fault...');

    // Use setTimeout to not block UI
    setTimeout(() => {
      const t0 = performance.now();
      const bridgeLine = findGoodBridgeFault(
        adjRef.current, sources, gridData.lines, allBusesRef.current
      );
      const elapsed = (performance.now() - t0).toFixed(0);

      if (bridgeLine !== null) {
        showToast(`Bridge found in ${elapsed}ms — triggering fault...`);
        handleTriggerFault(bridgeLine);
      } else {
        showToast('No bridge edges found — grid is fully redundant');
      }
    }, 50);
  }, [gridData, sources, handleTriggerFault, showToast]);

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

  return (
    <div className="app">
      <StatusBar gridData={gridData} simState={simState} />
      <div className="app-body">
        <MapView
          gridData={gridData}
          simState={simState}
          layers={layers}
          tileLayer={tileLayer}
          isolateFault={isolateFault}
          onTriggerFault={handleTriggerFault}
        />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}