import React from 'react';
import { Zap, Cpu, Activity, ZapOff, Radio } from 'lucide-react';

export default function StatusBar({ simState, onNavigateToSim }) {
    const { energized } = simState;

    return (
        <div className="status-bar glass">
            <div className="logo">
                <Activity size={18} color="var(--accent)" />
                <span>GRID VIEWER</span>
            </div>

            <div className="divider" />

            <div className="stat-item">
                <span className="label">Mode</span>
                <span className="value">LIVE MONITORING</span>
            </div>

            <div className="stat-item" style={{ marginLeft: 'auto' }}>
                <span className="label">System Status</span>
                {energized ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="pulse-ring" style={{ color: 'var(--sensor-live)', width: 8, height: 8 }} >
                            <div style={{ width: 8, height: 8, background: 'var(--sensor-live)', borderRadius: '50%' }} />
                        </div>
                        <span className="value" style={{ color: 'var(--sensor-live)' }}>ONLINE</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, background: 'var(--text-muted)', borderRadius: '50%' }} />
                        <span className="value" style={{ color: 'var(--text-muted)' }}>OFFLINE</span>
                    </div>
                )}
            </div>

            <div className="divider" />

            <div className="stat-item">
                <Radio size={14} style={{ marginRight: 4, color: 'var(--text-secondary)' }} />
                <span className="value">Rx: 42ms</span>
            </div>
        </div>
    );
}
