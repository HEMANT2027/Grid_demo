import React from 'react';
import {
    Zap,
    Map as MapIcon,
    Layers,
    Settings,
    RotateCcw,
    Activity,
    AlertTriangle,
    Satellite,
    Sun,
    Moon,
    Radio,
    Play,
    Square,
    Wrench,
    Target,
    Eye,
    EyeOff,
    Crop
} from 'lucide-react';

export default function ControlPanel({
    gridData, simState, onEnergize, onDeenergize, onPlaceSensors,
    onTriggerFault, onTriggerBridgeFault, onRepairFault, onReset, layers, onToggleLayer,
    tileLayer, onChangeTile, isolateFault, onToggleIsolateFault,
    isSelectingArea, onToggleAreaSelection
}) {
    const { energized, sensors, faultInfo } = simState;

    return (
        <div className="control-panel">
            {/* Quick Actions */}
            <div className="panel-section quick-actions">
                <div className="section-title">
                    <Settings size={14} /> Quick Actions
                </div>
                
                <div className="action-grid">
                    {!energized ? (
                        <button className="action-btn primary" onClick={onEnergize} disabled={!gridData}>
                            <Play size={18} />
                            <span>Energize Grid</span>
                        </button>
                    ) : (
                        <button className="action-btn danger" onClick={onDeenergize}>
                            <Square size={18} />
                            <span>De-energize</span>
                        </button>
                    )}
                    
                    <button 
                        className="action-btn" 
                        onClick={onPlaceSensors}
                        disabled={!gridData || sensors.length > 0}
                    >
                        <Radio size={18} />
                        <span>Deploy Sensors</span>
                    </button>
                </div>

                {sensors.length > 0 && (
                    <div className="info-badge">
                        <Radio size={12} />
                        {sensors.length} sensors in {simState.blocks?.length || 0} blocks
                    </div>
                )}
            </div>

            {/* Fault Testing */}
            <div className="panel-section">
                <div className="section-title">
                    <Activity size={14} /> Fault Testing
                </div>
                
                {!faultInfo ? (
                    <>
                        <button
                            className="btn-modern danger"
                            onClick={onTriggerBridgeFault}
                            disabled={!energized}
                        >
                            <Target size={16} />
                            <div className="btn-content">
                                <div className="btn-label">Bridge Fault</div>
                                <div className="btn-hint">Critical line failure</div>
                            </div>
                        </button>
                        
                        <button
                            className="btn-modern danger"
                            onClick={onTriggerFault}
                            disabled={!energized}
                        >
                            <AlertTriangle size={16} />
                            <div className="btn-content">
                                <div className="btn-label">Random Fault</div>
                                <div className="btn-hint">Any line failure</div>
                            </div>
                        </button>
                    </>
                ) : (
                    <button
                        className="btn-modern success"
                        onClick={onRepairFault}
                    >
                        <Wrench size={16} />
                        <div className="btn-content">
                            <div className="btn-label">Repair Fault</div>
                            <div className="btn-hint">Restore grid power</div>
                        </div>
                    </button>
                )}

                {faultInfo && (
                    <div className="toggle-card">
                        <div className="toggle-card-content">
                            <div className="toggle-card-icon">
                                {isolateFault ? <Eye size={16} /> : <EyeOff size={16} />}
                            </div>
                            <div className="toggle-card-text">
                                <div className="toggle-card-label">Isolate Fault</div>
                                <div className="toggle-card-hint">Show only faulted line</div>
                            </div>
                        </div>
                        <div
                            className={`toggle-switch-modern ${isolateFault ? 'on' : ''}`}
                            onClick={onToggleIsolateFault}
                        />
                    </div>
                )}
            </div>

            {/* Area Selection - Only show if handlers are provided */}
            {onToggleAreaSelection && (
                <div className="panel-section">
                    <div className="section-title">
                        <Crop size={14} /> Area Selection
                    </div>
                    <button
                        className={`btn-modern ${isSelectingArea ? 'active' : ''}`}
                        onClick={onToggleAreaSelection}
                    >
                        <Crop size={16} />
                        <div className="btn-content">
                            <div className="btn-label">{isSelectingArea ? 'Cancel Selection' : 'Select Area'}</div>
                            <div className="btn-hint">{isSelectingArea ? 'Click on map to draw area' : 'Draw rectangle on map'}</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Map Style */}
            <div className="panel-section">
                <div className="section-title">
                    <MapIcon size={14} /> Map Style
                </div>
                <div className="tile-grid">
                    <button
                        className={`tile-card ${tileLayer === 'dark' ? 'active' : ''}`}
                        onClick={() => onChangeTile('dark')}
                    >
                        <Moon size={16} />
                        <span>Dark</span>
                    </button>
                    <button
                        className={`tile-card ${tileLayer === 'light' ? 'active' : ''}`}
                        onClick={() => onChangeTile('light')}
                    >
                        <Sun size={16} />
                        <span>Light</span>
                    </button>
                    <button
                        className={`tile-card ${tileLayer === 'satellite' ? 'active' : ''}`}
                        onClick={() => onChangeTile('satellite')}
                    >
                        <Satellite size={16} />
                        <span>Satellite</span>
                    </button>
                </div>
            </div>

            {/* Layers */}
            <div className="panel-section">
                <div className="section-title">
                    <Layers size={14} /> Map Layers
                </div>
                <div className="layer-list">
                    {[
                        { key: 'lines', label: 'Transmission Lines', icon: Activity },
                        { key: 'substations', label: 'Substations', icon: Zap },
                        { key: 'towers', label: 'Towers', icon: Radio },
                        { key: 'poles', label: 'Poles', icon: Target },
                        { key: 'sensors', label: 'Sensors', icon: Radio },
                        { key: 'source', label: 'Power Source', icon: Zap },
                    ].map(({ key, label, icon: Icon }) => (
                        <div 
                            key={key} 
                            className={`layer-item ${layers[key] ? 'active' : ''}`}
                            onClick={() => onToggleLayer(key)}
                        >
                            <div className="layer-item-left">
                                <Icon size={14} />
                                <span>{label}</span>
                            </div>
                            <div className={`checkbox ${layers[key] ? 'checked' : ''}`}>
                                {layers[key] && <div className="checkmark">✓</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reset */}
            <div className="panel-section">
                <button className="btn-reset" onClick={onReset}>
                    <RotateCcw size={16} />
                    <span>Reset Simulation</span>
                </button>
            </div>
        </div>
    );
}
