/**
 * Sensor Placement Engine
 * 
 * Implements interval-based sampling on poles/towers with strategic placement:
 * - One sensor just after each power source (substation)
 * - One sensor at the end of each DFS path from power sources
 * - Regular interval sensors every L poles
 */

/**
 * Haversine formula to calculate distance between two lat/lon points in meters.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
}

/**
 * Perform DFS from power sources to find path endpoints.
 * @param {Map} adj - Adjacency list
 * @param {Array} sources - Power source bus IDs
 * @returns {Object} { endpoints: Set, pathOrder: Array }
 */
function findPathEndpoints(adj, sources) {
    const visited = new Set();
    const endpoints = new Set();
    const pathOrder = [];
    
    function dfs(node, depth) {
        if (visited.has(node)) return;
        
        visited.add(node);
        pathOrder.push(node);
        
        const neighbors = adj.get(node) || [];
        const unvisitedNeighbors = neighbors.filter(n => !visited.has(n.to));
        
        // If no unvisited neighbors, this is an endpoint
        if (unvisitedNeighbors.length === 0 && depth > 0) {
            endpoints.add(node);
        }
        
        // Continue DFS
        for (const { to } of unvisitedNeighbors) {
            dfs(to, depth + 1);
        }
    }
    
    // Run DFS from each source
    for (const source of sources) {
        if (!visited.has(source)) {
            dfs(source, 0);
        }
    }
    
    return { endpoints, pathOrder };
}

/**
 * Find buses near substations (within radius).
 * @param {Array} substations - Array of [lon, lat, voltage, name]
 * @param {Map} busGeoMap - Map of bus ID to [lon, lat]
 * @param {number} maxRadius - Maximum radius in meters
 * @returns {Map} Map of substation location to nearest bus ID
 */
function findSubstationBuses(substations, busGeoMap, maxRadius = 2000) {
    const substationBusMap = new Map();
    
    for (const [subLon, subLat, voltage, name] of substations) {
        let nearestBusId = null;
        let minDistance = Infinity;
        
        for (const [busId, [busLon, busLat]] of busGeoMap.entries()) {
            const distance = haversineDistance(subLat, subLon, busLat, busLon);
            if (distance < minDistance && distance < maxRadius) {
                minDistance = distance;
                nearestBusId = busId;
            }
        }
        
        if (nearestBusId !== null) {
            const key = `${subLon},${subLat}`;
            substationBusMap.set(key, nearestBusId);
        }
    }
    
    return substationBusMap;
}

/**
 * Place sensors using interval-based sampling with strategic placement.
 * @param {Array} poles - Array of [lon, lat] pole/tower locations
 * @param {Map} busGeoMap - Map of bus ID to [lon, lat]
 * @param {number} interval - Place sensor every L poles (e.g., 50)
 * @param {Map} adj - Adjacency list for DFS
 * @param {Array} sources - Power source bus IDs
 * @param {Array} substations - Array of [lon, lat, voltage, name]
 * @returns {Object} { sensors: busIds[], poleIndices: [], intervals: [], metrics: {} }
 */
export function placeSensorsIntervalBased(poles, busGeoMap, interval = 50, adj = null, sources = [], substations = []) {
    if (!poles || poles.length === 0) {
        return {
            sensors: [],
            poleIndices: [],
            intervals: [],
            metrics: {
                totalPoles: 0,
                sensorsPlaced: 0,
                systemResolution: 0,
                maxSpanGap: 0,
                avgSpanGap: 0,
                strategicSensors: 0,
                intervalSensors: 0
            }
        };
    }

    const N = poles.length;
    const strategicSensors = new Set(); // Sensors near substations and endpoints
    const intervalSensorIndices = [];
    
    // Step 1: Place sensors near substations (one per substation)
    if (substations && substations.length > 0) {
        const substationBusMap = findSubstationBuses(substations, busGeoMap);
        const usedSubstationBuses = new Set();
        
        for (const busId of substationBusMap.values()) {
            if (!usedSubstationBuses.has(busId)) {
                strategicSensors.add(busId);
                usedSubstationBuses.add(busId);
            }
        }
        
        console.log(`Placed ${strategicSensors.size} sensors near substations`);
    }
    
    // Step 2: Place sensors at path endpoints (if DFS info available)
    if (adj && sources && sources.length > 0) {
        const { endpoints } = findPathEndpoints(adj, sources);
        
        for (const endpointBus of endpoints) {
            strategicSensors.add(endpointBus);
        }
        
        console.log(`Added ${endpoints.size} sensors at path endpoints`);
    }
    
    // Step 3: Place interval-based sensors every L poles
    for (let i = 0; i < N; i += interval) {
        intervalSensorIndices.push(i);
    }
    
    // Find nearest bus for each interval sensor
    const intervalSensors = [];
    for (const poleIdx of intervalSensorIndices) {
        const [poleLon, poleLat] = poles[poleIdx];
        
        let nearestBusId = null;
        let minDistance = Infinity;
        
        for (const [busId, [busLon, busLat]] of busGeoMap.entries()) {
            const distance = haversineDistance(poleLat, poleLon, busLat, busLon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestBusId = busId;
            }
        }
        
        if (nearestBusId !== null) {
            intervalSensors.push(nearestBusId);
        }
    }
    
    // Step 4: Combine strategic and interval sensors (remove duplicates)
    const allSensors = [...strategicSensors, ...intervalSensors];
    const uniqueSensors = [...new Set(allSensors)];
    
    // Step 5: Create intervals (groups of poles between sensors)
    const intervals = [];
    const sensorPoleIndices = [];
    
    // Map sensors back to pole indices for interval calculation
    for (const sensorBus of uniqueSensors) {
        const [sensorLon, sensorLat] = busGeoMap.get(sensorBus) || [0, 0];
        
        // Find nearest pole to this sensor
        let nearestPoleIdx = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < poles.length; i++) {
            const [poleLon, poleLat] = poles[i];
            const distance = haversineDistance(sensorLat, sensorLon, poleLat, poleLon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoleIdx = i;
            }
        }
        
        sensorPoleIndices.push(nearestPoleIdx);
    }
    
    // Sort sensor pole indices
    sensorPoleIndices.sort((a, b) => a - b);
    
    // Create intervals between sorted sensors
    for (let i = 0; i < sensorPoleIndices.length; i++) {
        const startIdx = sensorPoleIndices[i];
        const endIdx = i < sensorPoleIndices.length - 1 
            ? sensorPoleIndices[i + 1] 
            : N;
        
        const intervalPoles = [];
        for (let j = startIdx; j < endIdx && j < N; j++) {
            intervalPoles.push(j);
        }
        intervals.push(intervalPoles);
    }
    
    // Step 6: Calculate metrics
    const k = uniqueSensors.length;
    const systemResolution = k > 0 ? N / k : 0;
    
    // Calculate span gaps (geographic distances between consecutive sensors)
    const spanGaps = [];
    for (let i = 0; i < sensorPoleIndices.length - 1; i++) {
        const idx1 = sensorPoleIndices[i];
        const idx2 = sensorPoleIndices[i + 1];
        
        const [lon1, lat1] = poles[idx1];
        const [lon2, lat2] = poles[idx2];
        
        const distance = haversineDistance(lat1, lon1, lat2, lon2);
        spanGaps.push(distance);
    }
    
    const maxSpanGap = spanGaps.length > 0 ? Math.max(...spanGaps) : 0;
    const avgSpanGap = spanGaps.length > 0 
        ? spanGaps.reduce((a, b) => a + b, 0) / spanGaps.length 
        : 0;
    
    const metrics = {
        totalPoles: N,
        sensorsPlaced: k,
        systemResolution: systemResolution,
        maxSpanGap: maxSpanGap,
        avgSpanGap: avgSpanGap,
        interval: interval,
        strategicSensors: strategicSensors.size,
        intervalSensors: intervalSensors.length
    };
    
    console.log('Interval-Based Sensor Placement:');
    console.log(`  Total Poles (N): ${N}`);
    console.log(`  Sensors Placed (k): ${k}`);
    console.log(`  Strategic Sensors: ${strategicSensors.size} (substations + endpoints)`);
    console.log(`  Interval Sensors: ${intervalSensors.length}`);
    console.log(`  Interval (L): ${interval}`);
    console.log(`  System Resolution (N/k): ${systemResolution.toFixed(2)}`);
    console.log(`  Max Span Gap: ${(maxSpanGap / 1000).toFixed(2)} km`);
    console.log(`  Avg Span Gap: ${(avgSpanGap / 1000).toFixed(2)} km`);
    
    return {
        sensors: uniqueSensors,
        poleIndices: sensorPoleIndices,
        intervals: intervals,
        metrics: metrics
    };
}

/**
 * Read sensor status from energized map.
 * @returns {Map<number, number>} sensorBus -> 0|1
 */
export function readSensors(sensors, energizedStatus) {
    const readings = new Map();
    for (const s of sensors) {
        readings.set(s, energizedStatus.get(s) || 0);
    }
    return readings;
}

/**
 * Identify the faulty interval between sensors.
 * Returns the interval index where fault occurred.
 * @param {Array} sensors - Array of sensor bus IDs
 * @param {Map} sensorReadings - Map of sensor readings
 * @returns {number} interval index or -1
 */
export function identifyFaultyInterval(sensors, sensorReadings) {
    for (let i = 0; i < sensors.length; i++) {
        const status = sensorReadings.get(sensors[i]) || 0;
        if (status === 0) {
            // Found first dead sensor
            // Fault is in the interval BEFORE this sensor
            return i;
        }
    }
    return -1; // No fault detected
}

// Legacy function for backward compatibility
export function identifyFaultyBlock(sensors, sensorReadings) {
    return identifyFaultyInterval(sensors, sensorReadings);
}

// Legacy function for backward compatibility (deprecated)
export function placeSensorsSqrtN(adj, sources, allBuses) {
    console.warn('placeSensorsSqrtN is deprecated. Use placeSensorsIntervalBased instead.');
    return { sensors: [], blocks: [], intervals: [] };
}
