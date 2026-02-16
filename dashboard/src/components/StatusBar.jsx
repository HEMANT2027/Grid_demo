import React from 'react';
import { Zap, Cpu, Activity, ZapOff } from 'lucide-react';

export default function StatusBar({ simState, onNavigateToSim }) {
    const { energized } = simState;

    return (
        <div className="status-bar">
            <div className="logo">
                <Zap size={18} /> GRID VIEWER
            </div>
            <div className="divider" />

            <div className="stat-item">
                <span className="label">Mode</span>
                <span className="value">PMTiles</span>
            </div>

            <div className="stat-item">
                {energized
                    ? <><Zap size={14} color="#FFD600" style={{ marginRight: 4 }} /><span className="value live">Energized</span></>
                    : <><ZapOff size={14} color="#555" style={{ marginRight: 4 }} /><span className="value" style={{ color: '#555' }}>De-energized</span></>
                }
            </div>

            <div className="divider" />

            <div className="stat-item">
                <Cpu size={14} style={{ marginRight: 4, color: '#555' }} />
                <span className="value" style={{ color: '#555' }}>Ready</span>
            </div>

            {onNavigateToSim && (
                <button
                    onClick={onNavigateToSim}
                    style={{
                        marginLeft: 'auto',
                        background: 'linear-gradient(135deg, #00BCD4, #0097A7)',
                        border: 'none',
                        color: '#fff',
                        padding: '4px 14px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <Activity size={12} /> Simulation Lab
                </button>
            )}
        </div>
    );
}
