import { useState, useEffect, useCallback } from 'react';
import StatusBar from '../components/StatusBar';
import MapView from '../components/MapView';
import '../index.css';

const INITIAL_LAYERS = {
  lines: true,
  towers: false,
  poles: false,
  substations: true,
};

const EMPTY_SIM_STATE = {
  energized: false,
  sensors: [],
  blocks: [],
  sensorReadings: null,
  energizedStatus: null,
  faultInfo: null,
  faultyBlock: -1,
};

export default function DashboardPage() {
  const [gridData, setGridData] = useState(null);
  const [layers] = useState(INITIAL_LAYERS);
  const [tileLayer] = useState('dark');
  const [toast, setToast] = useState(null);
  const simState = EMPTY_SIM_STATE;

  // Load grid data from PostgreSQL via API 
  useEffect(() => {
    console.log('Starting to fetch grid data...');
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    // Default to 'delhi' region to prevent loading all of India at once
    const fetchUrl = `${apiUrl}/grid-data?region=delhi`;
    console.log('Fetching from:', fetchUrl);
    
    fetch(fetchUrl)
      .then(r => {
        console.log('Response status:', r.status);
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        console.log('Grid data received:', data);
        setGridData(data);
        showToast(`Grid loaded: ${data.stats.total_buses.toLocaleString()} buses, ${data.stats.total_lines.toLocaleString()} lines`);
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

  return (
    <div className="app">
      <StatusBar gridData={gridData} simState={simState} />
      <div className="app-body">
        <MapView
          gridData={gridData}
          simState={simState}
          layers={layers}
          tileLayer={tileLayer}
          isolateFault={false}
        />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}