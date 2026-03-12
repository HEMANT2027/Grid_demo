/**
 * PlannerMap — Self-contained Leaflet map for the Infrastructure Planner.
 *
 * Renders:
 *  • OSM India basemap (CartoDB Light tiles)
 *  • Blue markers for user-placed/imported nodes (larger for substations)
 *  • Orange polylines for transmission edges
 *  • Green markers for algorithmically-placed sensors
 *  • Compact legend
 *
 * Fully isolated — does NOT reuse MapView.jsx from the simulation system.
 */

import React, { useMemo, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

// ─── Fit map bounds to data ──────────────────────────────────────────
function FitBounds({ nodes }) {
  const map = useMap();

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    let hasValidCoords = false;

    for (const n of nodes) {
      if (n.lat != null && n.lon != null && !isNaN(n.lat) && !isNaN(n.lon)) {
        if (n.lat < minLat) minLat = n.lat;
        if (n.lat > maxLat) maxLat = n.lat;
        if (n.lon < minLon) minLon = n.lon;
        if (n.lon > maxLon) maxLon = n.lon;
        hasValidCoords = true;
      }
    }

    if (hasValidCoords) {
      const bounds = [
        [minLat, minLon],
        [maxLat, maxLon],
      ];
      // Only fit if the data spans a reasonable area
      if (bounds[0][0] !== bounds[1][0] || bounds[0][1] !== bounds[1][1]) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [nodes, map]);

  return null;
}

// ─── Constants ───────────────────────────────────────────────────────
const INDIA_CENTER = [22.5, 78.5];
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const COLORS = {
  substation: '#1A56DB',   // accent blue
  bus: '#4B83F0',          // lighter blue
  pole: '#94A3B8',         // slate grey
  tower: '#64748B',        // darker slate
  edge: '#E8590C',         // vivid orange
  sensor: '#0E9F6E',       // green
  sensorBorder: '#065F46',
};

const NODE_RADIUS = {
  substation: 7,
  bus: 5,
  pole: 3,
  tower: 3,
};

// ─── Node layer ──────────────────────────────────────────────────────
function NodeLayer({ nodes, onNodeClick }) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <>
      {nodes.map((n) => {
        const r = NODE_RADIUS[n.type] || 4;
        const color = COLORS[n.type] || COLORS.bus;
        const isSubstation = n.type === 'substation';

        return (
          <CircleMarker
            key={`n-${n.id}`}
            center={[n.lat, n.lon]}
            radius={r}
            pathOptions={{
              color: isSubstation ? '#0F3A8E' : color,
              fillColor: color,
              fillOpacity: isSubstation ? 1 : 0.85,
              weight: isSubstation ? 2 : 1,
            }}
            eventHandlers={{
              click: () => onNodeClick && onNodeClick(n)
            }}
          >
            <Tooltip>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11 }}>
                <strong>{n.type === 'substation' ? 'Substation' : n.type === 'bus' ? 'Bus / Junction' : n.type === 'tower' ? 'Tower' : 'Pole'}</strong>
                <br />
                ID: {n.id}
                <br />
                {n.lat.toFixed(5)}, {n.lon.toFixed(5)}
                {n.voltage ? <><br />Voltage: {n.voltage} kV</> : null}
                {n.name ? <><br />{n.name}</> : null}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// ─── Edge layer ──────────────────────────────────────────────────────
function EdgeLayer({ edges, nodeGeoMap }) {
  if (!edges || edges.length === 0 || nodeGeoMap.size === 0) return null;

  return (
    <>
      {edges.map((e) => {
        const from = nodeGeoMap.get(e.source);
        const to = nodeGeoMap.get(e.target);
        if (!from || !to) return null;

        return (
          <Polyline
            key={`e-${e.id}`}
            positions={[
              [from[1], from[0]], // [lat, lon]
              [to[1], to[0]],
            ]}
            pathOptions={{
              color: COLORS.edge,
              weight: 2.5,
              opacity: 0.8,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11 }}>
                <strong>Line {e.id}</strong>
                <br />
                {e.voltage ? `${e.voltage} kV` : 'Voltage N/A'}
                <br />
                Node {e.source} → Node {e.target}
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}

// ─── Sensor layer ────────────────────────────────────────────────────
function SensorLayer({ sensorIds, nodeGeoMap }) {
  if (!sensorIds || sensorIds.length === 0 || nodeGeoMap.size === 0) return null;

  return (
    <>
      {sensorIds.map((sId, i) => {
        const geo = nodeGeoMap.get(sId);
        if (!geo) return null;

        return (
          <CircleMarker
            key={`s-${sId}-${i}`}
            center={[geo[1], geo[0]]}
            radius={6}
            pathOptions={{
              color: COLORS.sensorBorder,
              fillColor: COLORS.sensor,
              fillOpacity: 0.95,
              weight: 2,
            }}
          >
            <Tooltip>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11 }}>
                <strong>Sensor S{i + 1}</strong>
                <br />
                Node {sId}
                <br />
                {geo[1].toFixed(5)}, {geo[0].toFixed(5)}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────
const legendStyle = {
  position: 'absolute',
  bottom: 24,
  right: 12,
  zIndex: 1000,
  background: 'rgba(255,255,255,0.95)',
  border: '1px solid #E2E6ED',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 11,
  fontFamily: "'IBM Plex Sans', sans-serif",
  color: '#334155',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  lineHeight: 1.8,
  pointerEvents: 'none',
};

function Legend({ sensorCount }) {
  return (
    <div style={legendStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>Map Legend</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.substation, display: 'inline-block', border: '1.5px solid #0F3A8E' }} />
        Substation
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.bus, display: 'inline-block' }} />
        Bus / Junction
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 3, background: COLORS.edge, display: 'inline-block', borderRadius: 1 }} />
        Transmission Line
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.sensor, display: 'inline-block', border: `1.5px solid ${COLORS.sensorBorder}` }} />
        Sensor ({sensorCount})
      </div>
    </div>
  );
}

// ─── Draw Control ─────────────────────────────────────────────────────
function DrawControl({ onDrawCreated, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !enabled) return;

    const drawLayer = new L.FeatureGroup();
    map.addLayer(drawLayer);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      edit: {
        featureGroup: drawLayer,
        remove: false, // UI handles bulk actions if needed
        edit: false,
      },
      draw: {
        polygon: false,
        rectangle: false,
        circle: false,
        circlemarker: false, // removed per user request
        marker: {
          icon: L.divIcon({
            className: 'custom-substation-icon',
            html: `<div style="width: 14px; height: 14px; border-radius: 50%; background: ${COLORS.substation}; border: 2px solid #0F3A8E;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          }),
        },
        polyline: {
          shapeOptions: {
            color: COLORS.edge,
            weight: 3,
            opacity: 0.8
          }
        }
      }
    });

    map.addControl(drawControl);

    const handleCreated = (e) => {
      // Don't keep it in the Leaflet.Draw layer, React state handles rendering
      if (onDrawCreated) {
        onDrawCreated(e);
      }
    };

    map.on(L.Draw.Event.CREATED, handleCreated);

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawLayer);
      map.off(L.Draw.Event.CREATED, handleCreated);
    };
  }, [map, enabled, onDrawCreated]);

  return null;
}

// ─── Main PlannerMap Component ───────────────────────────────────────
export default function PlannerMap({ nodes, edges, sensorLocations, drawModeEnabled, onDrawCreated, onNodeClick }) {
  // Build geo lookup: id → [lon, lat]
  const nodeGeoMap = useMemo(() => {
    const m = new Map();
    if (nodes) {
      for (const n of nodes) {
        m.set(n.id, [n.lon, n.lat]);
      }
    }
    return m;
  }, [nodes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
        preferCanvas={true}
        zoomControl={true}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />

        {nodes && nodes.length > 0 && <FitBounds nodes={nodes} />}

        <EdgeLayer edges={edges} nodeGeoMap={nodeGeoMap} />
        <NodeLayer nodes={nodes} onNodeClick={onNodeClick} />
        <SensorLayer sensorIds={sensorLocations} nodeGeoMap={nodeGeoMap} />
        <DrawControl enabled={drawModeEnabled} onDrawCreated={onDrawCreated} />
      </MapContainer>

      <Legend sensorCount={sensorLocations ? sensorLocations.length : 0} />
    </div>
  );
}
