/**
 * Infrastructure Planner Engine
 * 
 * Self-contained pipeline: topology → adjacency graph → BFS energization → DFS sensor placement.
 * Operates on the planner's own data format, fully isolated from the Simulation engine.
 * 
 * Data Conventions (OSM / Indian Power Grid):
 *   Node types: 'substation', 'bus', 'tower', 'pole'
 *   Edge voltage levels: 765, 400, 220, 132, 110, 66, 33, 22, 11 kV
 *   Coordinates: WGS84 (lat/lon in decimal degrees)
 */

// ─── Haversine distance (meters) ────────────────────────────────────
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Build adjacency list ───────────────────────────────────────────
/**
 * @param {Array<{id, source, target, voltage}>} edges
 * @returns {Map<id, Array<{to, edgeId}>>}
 */
export function buildAdjacencyList(edges) {
  const adj = new Map();
  for (const edge of edges) {
    const { id, source, target } = edge;
    if (source == null || target == null) continue;
    if (!adj.has(source)) adj.set(source, []);
    if (!adj.has(target)) adj.set(target, []);
    adj.get(source).push({ to: target, edgeId: id });
    adj.get(target).push({ to: source, edgeId: id });
  }
  return adj;
}

// ─── BFS energization from substations ───────────────────────────────
/**
 * @param {Map} adj
 * @param {number[]} substationIds
 * @param {Set<number>} [disabledEdges] — optional, for future fault injection
 * @returns {Map<id, 0|1>}
 */
export function runEnergization(adj, substationIds, disabledEdges = new Set()) {
  const visited = new Set();
  const queue = [];

  for (const s of substationIds) {
    if (adj.has(s)) {
      visited.add(s);
      queue.push(s);
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const { to, edgeId } of adj.get(cur) || []) {
      if (!visited.has(to) && !disabledEdges.has(edgeId)) {
        visited.add(to);
        queue.push(to);
      }
    }
  }

  // Build status map for ALL nodes in adjacency list
  const status = new Map();
  for (const nodeId of adj.keys()) {
    status.set(nodeId, visited.has(nodeId) ? 1 : 0);
  }
  return status;
}

// ─── Count poles between two nodes ──────────────────────────────────
/**
 * Count pole/tower features that lie along the segment between two buses.
 */
function countInfrastructureBetween(bus1, bus2, nodeGeoMap, poles) {
  if (!poles || poles.length === 0) return 1; // default: treat each hop as 1 unit

  const geo1 = nodeGeoMap.get(bus1);
  const geo2 = nodeGeoMap.get(bus2);
  if (!geo1 || !geo2) return 1;

  const [lon1, lat1] = geo1;
  const [lon2, lat2] = geo2;
  const segLen = haversineDistance(lat1, lon1, lat2, lon2);
  if (segLen < 50) return 0; // very close nodes

  let count = 0;
  const tolerance = Math.max(200, segLen * 0.05);

  for (const pole of poles) {
    const [pLon, pLat] = [pole.lon, pole.lat];
    const d1 = haversineDistance(lat1, lon1, pLat, pLon);
    const d2 = haversineDistance(lat2, lon2, pLat, pLon);
    if (Math.abs(d1 + d2 - segLen) <= tolerance) {
      count++;
    }
  }

  return Math.max(count, 1); // at least 1 hop
}

// ─── DFS-based interval sensor placement ─────────────────────────────
/**
 * Places sensors along DFS paths from substations, every L poles/hops.
 * Identical logic to sensorEngine.js but operating on the planner's data format.
 *
 * @param {Array} nodes        — [{ id, lat, lon, type }]
 * @param {Array} edges        — [{ id, source, target, voltage }]
 * @param {Map} adj            — adjacency list
 * @param {Map} energized      — Map<nodeId, 0|1>
 * @param {number[]} substationIds
 * @param {number} interval    — L (poles/hops between sensors)
 * @returns {{ sensors, metrics }}
 */
export function placeSensors(nodes, edges, adj, energized, substationIds, interval = 50) {
  const nodeGeoMap = new Map();
  for (const n of nodes) {
    nodeGeoMap.set(n.id, [n.lon, n.lat]);
  }

  // Separate poles/towers for counting
  const poleNodes = nodes.filter(n => n.type === 'pole' || n.type === 'tower');

  const allSensors = [];
  const visitedEdges = new Set();
  const substationSet = new Set(substationIds);

  // Check if a node is within 300m of any substation
  function isInSubstationCluster(nodeId) {
    if (substationSet.has(nodeId)) return true;
    const geo = nodeGeoMap.get(nodeId);
    if (!geo) return false;
    for (const subId of substationIds) {
      const subGeo = nodeGeoMap.get(subId);
      if (!subGeo) continue;
      if (haversineDistance(geo[1], geo[0], subGeo[1], subGeo[0]) < 300) return true;
    }
    return false;
  }

  // Recursive DFS traversal
  function dfsTraverse(current, hopsSinceSensor, lastSensorNode) {
    const neighbors = adj.get(current) || [];
    let hasUnvisited = false;

    for (const { to, edgeId } of neighbors) {
      if (visitedEdges.has(edgeId)) continue;
      if (energized.get(to) !== 1) continue;
      // Do NOT `continue` if in substation cluster, otherwise we clip the whole branch!
      
      hasUnvisited = true;
      visitedEdges.add(edgeId);

      const hopCount = countInfrastructureBetween(current, to, nodeGeoMap, poleNodes);
      const newHops = hopsSinceSensor + hopCount;

      if (newHops >= interval) {
        if (!isInSubstationCluster(to)) {
          allSensors.push(to);
        }
        dfsTraverse(to, 0, to);
      } else {
        dfsTraverse(to, newHops, lastSensorNode);
      }
    }

    // End of path — place sensor at dead-end
    if (!hasUnvisited && hopsSinceSensor > 0 && current !== lastSensorNode) {
      if (!isInSubstationCluster(current)) {
        allSensors.push(current);
      }
    }
  }

  // Place sensors from each substation
  for (const subId of substationIds) {
    if (energized.get(subId) !== 1) continue;

    // R1: feeder exit sensor at substation. We always place this one regardless of connected edges.
    allSensors.push(subId);

    const neighbors = adj.get(subId) || [];
    const liveNeighbors = neighbors.filter(
      ({ to, edgeId }) => energized.get(to) === 1 && !visitedEdges.has(edgeId)
    );

    for (const { to, edgeId } of liveNeighbors) {
      if (visitedEdges.has(edgeId)) continue;
      // Do NOT `continue` if in substation cluster, we must still traverse to reach the rest of the grid!

      visitedEdges.add(edgeId);

      const hopCount = countInfrastructureBetween(subId, to, nodeGeoMap, poleNodes);

      if (hopCount >= interval) {
        if (!isInSubstationCluster(to)) {
          allSensors.push(to);
        }
        dfsTraverse(to, 0, to);
      } else {
        dfsTraverse(to, hopCount, subId);
      }
    }
  }

  // Deduplicate
  const uniqueSensors = Array.from(new Set(allSensors));

  // Compute metrics
  const totalNodes = nodes.filter(n => n.type === 'bus' || n.type === 'substation').length;
  const k = uniqueSensors.length;

  // Span gap calculation
  const spanGaps = [];
  for (let i = 0; i < uniqueSensors.length - 1; i++) {
    const g1 = nodeGeoMap.get(uniqueSensors[i]);
    const g2 = nodeGeoMap.get(uniqueSensors[i + 1]);
    if (g1 && g2) {
      spanGaps.push(haversineDistance(g1[1], g1[0], g2[1], g2[0]));
    }
  }

  return {
    sensors: uniqueSensors,
    metrics: {
      totalNodes,
      totalPoles: poleNodes.length,
      totalEdges: edges.length,
      sensorsPlaced: k,
      substations: substationIds.length,
      systemResolution: k > 0 ? (totalNodes / k).toFixed(2) : '∞',
      maxSpanGap: spanGaps.length > 0 ? spanGaps.reduce((a, b) => Math.max(a, b), -Infinity) : 0,
      avgSpanGap: spanGaps.length > 0
        ? spanGaps.reduce((a, b) => a + b, 0) / spanGaps.length
        : 0,
      interval,
    },
  };
}

// ─── Full pipeline orchestrator ──────────────────────────────────────
/**
 * Run the complete pipeline: build graph → energize → place sensors.
 *
 * @param {Array} nodes          — [{ id, lat, lon, type }]
 * @param {Array} edges          — [{ id, source, target, voltage }]
 * @param {number} interval      — L (sensor interval)
 * @returns {{ sensors, metrics, energizedStatus, adj }}
 */
export function runPipeline(nodes, edges, interval = 50) {
  if (!nodes || nodes.length === 0 || !edges || edges.length === 0) {
    return {
      sensors: [],
      metrics: {
        totalNodes: nodes?.length || 0,
        totalPoles: 0,
        totalEdges: 0,
        sensorsPlaced: 0,
        substations: 0,
        systemResolution: '∞',
        maxSpanGap: 0,
        avgSpanGap: 0,
        interval,
      },
      energizedStatus: new Map(),
      adj: new Map(),
    };
  }

  const substationIds = nodes
    .filter((n) => n.type === 'substation')
    .map((n) => n.id);

  const adj = buildAdjacencyList(edges);
  const energizedStatus = runEnergization(adj, substationIds);
  const { sensors, metrics } = placeSensors(
    nodes, edges, adj, energizedStatus, substationIds, interval
  );

  return { sensors, metrics, energizedStatus, adj };
}
