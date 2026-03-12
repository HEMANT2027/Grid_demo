/**
 * fileParser.js
 * 
 * Utility functions to parse uploaded Grid Infrastructure files (GeoJSON, CSV)
 * into a standardized format compatible with the Planner Pipeline.
 * 
 * Standard Format:
 * nodes: [{ id, lat, lon, type, voltage?, name? }]
 * edges: [{ id, source, target, voltage? }]
 */

// ─── GeoJSON Parser ──────────────────────────────────────────────────
export function parseGeoJSON(content) {
  const nodes = [];
  const edges = [];
  
  try {
    const geojson = JSON.parse(content);
    if (geojson.type !== 'FeatureCollection') {
      throw new Error('Root element must be a FeatureCollection');
    }

    const unassignedVertices = []; // For linestring vertices without endpoints

    for (const feature of geojson.features) {
      if (!feature.geometry) continue;

      const props = feature.properties || {};
      const { type, coordinates } = feature.geometry;
      
      // Node ID: use property ID, OSM ID, or generate one
      const rawId = props.id || props['@id'] || props.osmid || `import_${Date.now()}_${Math.random()}`;
      const idStr = String(rawId);

      // --- POINT (Nodes) ---
      if (type === 'Point') {
        const [lon, lat] = coordinates;
        
        // Determine type based on properties (OSM 'power' tag is standard)
        let nType = 'bus'; // default
        if (props.power === 'substation' || props.substation) nType = 'substation';
        else if (props.power === 'tower') nType = 'tower';
        else if (props.power === 'pole') nType = 'pole';
        else if (props.power === 'portal') nType = 'bus';

        nodes.push({
          id: idStr,
          lat,
          lon,
          type: nType,
          voltage: props.voltage ? parseInt(props.voltage) : null,
          name: props.name || null
        });
      }
      
      // --- LINESTRING (Edges) ---
      else if (type === 'LineString') {
        // A line in geojson is an array of [lon, lat] points.
        // We capture it as an edge, but the pipeline requires explicit node connections.
        // We'll parse the vertices to ensure topology is connected.
        for (let i = 0; i < coordinates.length - 1; i++) {
          const [lon1, lat1] = coordinates[i];
          const [lon2, lat2] = coordinates[i+1];

          // Create anonymous temporary vertices for the line segment
          const v1Id = `v_${idStr}_${i}`;
          const v2Id = `v_${idStr}_${i+1}`;

          unassignedVertices.push({ id: v1Id, lat: lat1, lon: lon1, type: 'pole' }); // intermediate points default to poles
          if (i === coordinates.length - 2) {
             unassignedVertices.push({ id: v2Id, lat: lat2, lon: lon2, type: 'bus' }); // Endpoints could be buses
          }

          edges.push({
            id: `edge_${idStr}_${i}`,
            source: v1Id,
            target: v2Id,
            voltage: props.voltage ? parseInt(props.voltage) : 132
          });
        }
      }
    }

    // --- Snapping / Topology Resolution ---
    // If we imported lines without explicit nodes, we need to snap them 
    // to existing nodes or register them as specific nodes.
    const SNAP_THRESHOLD = 0.0001; // roughly 10 meters

    function findClosestNodeId(targetLat, targetLon, collection) {
      for (const n of collection) {
        if (Math.abs(n.lat - targetLat) < SNAP_THRESHOLD && Math.abs(n.lon - targetLon) < SNAP_THRESHOLD) {
          return n.id;
        }
      }
      return null;
    }

    // Snap unassigned vertices to explicit point nodes, or register them if they don't exist
    for (const uv of unassignedVertices) {
      const existingId = findClosestNodeId(uv.lat, uv.lon, nodes);
      if (existingId) {
        // Re-wire edges pointing to this UV to point to the existing node
        for (const e of edges) {
          if (e.source === uv.id) e.source = existingId;
          if (e.target === uv.id) e.target = existingId;
        }
      } else {
        // It's a new node, add it to the final array
        nodes.push(uv);
      }
    }

    return { nodes, edges, error: null };
  } catch (err) {
    return { nodes: [], edges: [], error: 'Invalid GeoJSON: ' + err.message };
  }
}

// ─── CSV Parser ───────────────────────────────────────────────────────
export function parseCSV(content) {
  const nodes = [];
  const edges = [];
  
  try {
    const lines = content.trim().split('\n');
    if (lines.length === 0) throw new Error('Empty CSV file');

    // Basic header detection
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // We expect some combination of: type, id, lat, lon | id, source, target, voltage
    const idIdx = headers.indexOf('id');
    const typeIdx = headers.indexOf('type');
    const latIdx = headers.indexOf('lat');
    const lonIdx = headers.indexOf('lon');
    const sourceIdx = headers.indexOf('source');
    const targetIdx = headers.indexOf('target');
    const volIdx = headers.indexOf('voltage');

    if (idIdx === -1) throw new Error('CSV must contain an "id" column');

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // skip empty
        
        // Simple split (handles basic CSVs, won't handle quoted commas well, but sufficient for this scope)
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        
        const id = cols[idIdx];
        
        if (sourceIdx !== -1 && targetIdx !== -1 && cols[sourceIdx] && cols[targetIdx]) {
            // It's an edge
            edges.push({
                id: id,
                source: cols[sourceIdx],
                target: cols[targetIdx],
                voltage: volIdx !== -1 && cols[volIdx] ? parseInt(cols[volIdx]) : 132
            });
        } 
        else if (latIdx !== -1 && lonIdx !== -1 && cols[latIdx] && cols[lonIdx]) {
            // It's a node
            // Parse coordinate safely
            const lat = parseFloat(cols[latIdx]);
            const lon = parseFloat(cols[lonIdx]);
            if (isNaN(lat) || isNaN(lon)) continue;

            nodes.push({
                id: id,
                type: typeIdx !== -1 ? cols[typeIdx].toLowerCase() : 'bus',
                lat: lat,
                lon: lon,
                voltage: volIdx !== -1 && cols[volIdx] ? parseInt(cols[volIdx]) : null
            });
        }
    }

    return { nodes, edges, error: null };
  } catch(err) {
    return { nodes: [], edges: [], error: 'Invalid CSV: ' + err.message };
  }
}
