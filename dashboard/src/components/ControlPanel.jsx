import React from 'react';
import {
    Zap,
    Map as MapIcon,
    Layers,
    Settings,
    Moon,
    Sun,
    Satellite,
    Activity,
    ZapOff,
} from 'lucide-react';

export default function ControlPanel({
    simState, onEnergize, onDeenergize,
    layers, onToggleLayer,
    tileLayer, onChangeTile, onNavigateToSim
}) {
    const { energized } = simState;

    return (
        <div className="control-panel">
            {/* Map Style */}
            <div className="panel-section">
                <div className="section-title">
                    <MapIcon size={12} style={{ marginRight: 6 }} /> Map Style
                </div>
                <div className="tile-selector">
                    <button
                        className={`tile-btn ${tileLayer === 'dark' ? 'active' : ''}`}
                        onClick={() => onChangeTile('dark')}
                    >
                        <Moon size={10} style={{ marginRight: 4 }} /> Dark
                    </button>
                    <button
                        className={`tile-btn ${tileLayer === 'light' ? 'active' : ''}`}
                        onClick={() => onChangeTile('light')}
                    >
                        <Sun size={10} style={{ marginRight: 4 }} /> Light
                    </button>
                    <button
                        className={`tile-btn ${tileLayer === 'satellite' ? 'active' : ''}`}
                        onClick={() => onChangeTile('satellite')}
                    >
                        <Satellite size={10} style={{ marginRight: 4 }} /> Sat
                    </button>
                </div>
            </div>

            {/* Data Layers */}
            <div className="panel-section">
                <div className="section-title">
                    <Layers size={12} style={{ marginRight: 6 }} /> Layers
                </div>
                {[
                    { key: 'lines', label: 'Transmission Lines' },
                    { key: 'cables', label: 'Cables' },
                    { key: 'towers', label: 'Towers' },
                    { key: 'substations', label: 'Substations' },
                ].map(({ key, label }) => (
                    <div key={key} className={`toggle-row ${layers[key] ? 'active' : ''}`}>
                        <span className="toggle-label">{label}</span>
                        <div
                            className={`toggle-switch ${layers[key] ? 'on' : ''}`}
                            onClick={() => onToggleLayer(key)}
                        />
                    </div>
                ))}
            </div>

            {/* Grid Visual Control */}
            <div className="panel-section">
                <div className="section-title">
                    <Settings size={12} style={{ marginRight: 6 }} /> Grid Control
                </div>
                <div className={`toggle-row ${energized ? 'active' : ''}`}>
                    <span className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {energized ? <Zap size={14} color="#FFD600" /> : <ZapOff size={14} color="#555" />}
                        {energized ? 'Energized' : 'De-energized'}
                    </span>
                    <div
                        className={`toggle-switch ${energized ? 'on' : ''}`}
                        onClick={energized ? onDeenergize : onEnergize}
                    />
                </div>
            </div>

            {/* Simulation Lab Link */}
            <div className="panel-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <button
                    className="btn primary"
                    onClick={onNavigateToSim}
                    style={{
                        background: 'linear-gradient(135deg, #00BCD4, #0097A7)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 600,
                    }}
                >
                    <Activity size={14} /> Open Simulation Lab
                </button>
                <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 4 }}>
                    Sensor placement, fault injection & detection
                </div>
            </div>
        </div>
    );
}
