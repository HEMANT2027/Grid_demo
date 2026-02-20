import React from 'react';
import { Zap, Activity, Radio, AlertTriangle, Cpu, TrendingUp, TrendingDown } from 'lucide-react';

export default function StatusBar({ gridData, simState }) {
    const { energized, sensors, sensorReadings, faultInfo, faultyBlock } = simState;

    const totalBuses = gridData ? gridData.stats.total_buses : 0;
    const totalLines = gridData ? gridData.stats.total_lines : 0;

    let liveBuses = 0, deadBuses = 0;
    if (simState.energizedStatus) {
        simState.energizedStatus.forEach((v) => {
            if (v === 1) liveBuses++;
            else deadBuses++;
        });
    }

    let liveSensors = 0, deadSensors = 0;
    if (sensorReadings) {
        sensorReadings.forEach((v) => {
            if (v === 1) liveSensors++;
            else deadSensors++;
        });
    }

    const healthPercentage = totalBuses > 0 ? ((liveBuses / totalBuses) * 100).toFixed(1) : 100;

    return (
        <div className="status-bar">
            <div className="logo">
                <div className="logo-icon">
                    <Zap size={20} />
                </div>
                <div className="logo-text">
                    <div className="logo-title">POWER GRID</div>
                    <div className="logo-subtitle">Simulation Dashboard</div>
                </div>
            </div>
            
            <div className="status-cards">
                {/* Grid Status Card */}
                <div className={`status-card ${energized ? 'active' : ''}`}>
                    <div className="card-icon">
                        <Zap size={16} />
                    </div>
                    <div className="card-content">
                        <div className="card-label">Grid Status</div>
                        <div className="card-value">{energized ? 'ENERGIZED' : 'OFFLINE'}</div>
                    </div>
                </div>

                {/* Network Stats Card */}
                <div className="status-card">
                    <div className="card-icon">
                        <Activity size={16} />
                    </div>
                    <div className="card-content">
                        <div className="card-label">Network</div>
                        <div className="card-value">{totalBuses.toLocaleString()} buses • {totalLines.toLocaleString()} lines</div>
                    </div>
                </div>

                {/* Sensors Card */}
                {sensors.length > 0 && (
                    <div className="status-card">
                        <div className="card-icon">
                            <Radio size={16} />
                        </div>
                        <div className="card-content">
                            <div className="card-label">Sensors</div>
                            <div className="card-value">
                                {sensors.length} deployed
                                {sensorReadings && (
                                    <span className="card-subvalue">
                                        ({liveSensors} live • {deadSensors} dead)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Fault Card */}
                {faultInfo && (
                    <div className="status-card fault">
                        <div className="card-icon">
                            <AlertTriangle size={16} />
                        </div>
                        <div className="card-content">
                            <div className="card-label">Active Fault</div>
                            <div className="card-value">
                                Line {faultInfo.lineIdx}
                                {faultyBlock >= 0 && (
                                    <span className="card-subvalue"> • Block {faultyBlock + 1}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
