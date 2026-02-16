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
        <div className="control-panel glass">
            {/* Map Style */}
            <div className="panel-section">
                <div className="section-title">
                    <MapIcon size={12} style={{ marginRight: 8 }} /> Map Style
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
                    <Layers size={12} style={{ marginRight: 8 }} /> Signal Layers
                </div>
                {[
                    { key: 'lines', label: 'Transmission Grid' },
                    { key: 'cables', label: 'Underground Cables' },
                    { key: 'towers', label: 'Towers' },
                    { key: 'substations', label: 'Substations' },
                ].map(({ key, label }) => (
                    <div key={key} className="toggle-row" onClick={() => onToggleLayer(key)}>
                        <span className="toggle-label">{label}</span>
                        <div className={`toggle-switch ${layers[key] ? 'on' : ''}`} />
                    </div>
                ))}
            </div>

            {/* Grid Visual Control */}
            <div className="panel-section">
                <div className="section-title">
                    <Settings size={12} style={{ marginRight: 8 }} /> System Control
                </div>
                <div className="toggle-row" onClick={energized ? onDeenergize : onEnergize}>
                    <span className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {energized ?
                            <Zap size={14} color="var(--sensor-live)" fill="var(--sensor-live)" /> :
                            <ZapOff size={14} color="var(--text-muted)" />
                        }
                        {energized ? 'System Energized' : 'System Offline'}
                    </span>
                    <div className={`toggle-switch ${energized ? 'on' : ''}`} />
                </div>
            </div>

            {/* Simulation Lab Link */}
            <div className="panel-section" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
                <button
                    className="btn primary"
                    onClick={onNavigateToSim}
                >
                    <Activity size={14} /> Open Simulation Lab
                </button>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.4 }}>
                    Advanced analysis module<br />Version 2.4.0-alpha
                </div>
            </div>
        </div>
    );
}
