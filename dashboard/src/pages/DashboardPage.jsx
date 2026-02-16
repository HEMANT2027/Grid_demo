import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import ControlPanel from '../components/ControlPanel';
import MapView from '../components/MapView';
import '../index.css';

const INITIAL_LAYERS = {
    lines: true,
    cables: true,
    towers: false,
    substations: true,
    sensors: false, // Added sensors to initial state if it was missing in App.jsx but commonly used
};

export default function DashboardPage() {
    const [layers, setLayers] = useState(INITIAL_LAYERS);
    const [tileLayer, setTileLayer] = useState('dark');
    const [energized, setEnergized] = useState(true);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();

    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);

    const handleToggleLayer = useCallback((key) => {
        setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleEnergize = useCallback(() => {
        setEnergized(true);
        showToast('⚡ Grid energized');
    }, [showToast]);

    const handleDeenergize = useCallback(() => {
        setEnergized(false);
        showToast('Grid de-energized');
    }, [showToast]);

    return (
        <div className="app">
            <StatusBar
                simState={{ energized }}
                onNavigateToSim={() => window.open('/simulation', '_blank')}
            />
            <div className="app-body">
                <ControlPanel
                    simState={{ energized }}
                    onEnergize={handleEnergize}
                    onDeenergize={handleDeenergize}
                    layers={layers}
                    onToggleLayer={handleToggleLayer}
                    tileLayer={tileLayer}
                    onChangeTile={setTileLayer}
                    onNavigateToSim={() => window.open('/simulation', '_blank')}
                />
                <MapView
                    tileLayer={tileLayer}
                    layers={layers}
                    energized={energized}
                />
            </div>

            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
