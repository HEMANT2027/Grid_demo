/**
 * Sensor Placement Engine
 * 
 * Strategy:
 * - Place sensor at START of each energized wire path (from substation)
 * - Place sensor every K poles along the path
 * - Place sensor at END of each wire path
 * - Count duplicate sensors at substations
 */

/**
 * Haversine formula to calculate distance between two lat/lon points in meters.
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
    
    return R * c;
}

/**
 * Find nearest bus to a given location.
 */
function findNearestBus(lon, lat, busGeoMap, maxRadius = 200) {
    let nearestBusId = null;
    let minDistance = Infinity;
    
    for (const [busId, [busLon, busLat]] of busGeoMap.entries()) {
        const distance = haversineDistance(lat, lon, busLat, busLon);
        if (distance < minDistance && distance < maxRadius) {
            minDistance = distance;
            nearestBusId = busId;
        }
    }
    
    return nearestBusId;
}

/**
 * Count poles between two buses.
 */
function countPolesBetweenBuses(bus1, bus2, busGeoMap, poles) {
    const [lon1, lat1] = busGeoMap.get(bus1) || [0, 0];
    const [lon2, lat2] = busGeoMap.get(bus2) || [0, 0];
    
    const lineLength = haversineDistance(lat1, lon1, lat2, lon2);
    
    if (lineLength < 100) return 0;
    
    let poleCount = 0;
    
    for (const [poleLon, poleLat] of poles) {
        const distToStart = haversineDistance(lat1, lon1, poleLat, poleLon);
        const distToEnd = haversineDistance(lat2, lon2, poleLat, poleLon);
        
        const tolerance = Math.max(200, lineLength * 0.05);
        
        if (Math.abs((distToStart + distToEnd) - lineLength) <= tolerance) {
            poleCount++;
        }
    }
    
    return poleCount;
}

/**
 * Place sensors: start of each path, every K poles, and at end.
 */
export function placeSensorsIntervalBased(poles, busGeoMap, interval = 50, adj = null, sources = [], substations = [], energizedStatus = null) {
    if (!poles || poles.length === 0 || !adj || sources.length === 0 || !energizedStatus) {
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
                intervalSensors: 0,
                duplicateSensorsAtSubstations: 0
            }
        };
    }

    const N = poles.length;
    const allSensors = []; // All sensors including duplicates
    const sensorIntervals = []; // Pole count for each sensor
    const visitedEdges = new Set();
    const traversalLog = [];
    
    // Find substation buses
    const substationBuses = new Set();
    for (const [subLon, subLat] of substations) {
        const busId = findNearestBus(subLon, subLat, busGeoMap);
        if (busId !== null) {
            substationBuses.add(busId);
        }
    }
    
    /**
     * Check which substation area a bus belongs to (within radius).
     */
    function getSubstationForBus(busId) {
        const [busLon, busLat] = busGeoMap.get(busId) || [0, 0];
        
        for (let i = 0; i < substations.length; i++) {
            const [subLon, subLat] = substations[i];
            const distance = haversineDistance(busLat, busLon, subLat, subLon);
            if (distance < 300) { // Within 300m of substation
                return i; // Return substation index
            }
        }
        
        return null; // Not in any substation area
    }
    
    /**
     * DFS to traverse path, placing sensors every K poles and at the end.
     * @param {boolean} needsFirstSensor - if true, place sensor at first bus outside 300m
     */
    function traversePath(currentBus, polesSinceLastSensor, lastSensorBus, depth = 0, pathLog = [], needsFirstSensor = false) {
        const neighbors = adj.get(currentBus) || [];
        let hasUnvisitedEnergizedNeighbors = false;
        
        for (const { to: nextBus, lineIdx } of neighbors) {
            if (visitedEdges.has(lineIdx)) continue;
            if (energizedStatus.get(nextBus) !== 1) continue;
            
            hasUnvisitedEnergizedNeighbors = true;
            visitedEdges.add(lineIdx);
            
            const poleCount = countPolesBetweenBuses(currentBus, nextBus, busGeoMap, poles);
            const newPoleCount = polesSinceLastSensor + poleCount;
            
            pathLog.push(`${'  '.repeat(depth)}Line ${lineIdx} (Bus ${currentBus} → Bus ${nextBus}): ${poleCount} poles`);
            
            const isOutside300m = getSubstationForBus(nextBus) === null;
            
            // Case 1: We need to place the first sensor (just outside 300m)
            if (needsFirstSensor && isOutside300m) {
                allSensors.push(nextBus);
                sensorIntervals.push(0); // first sensor on path
                pathLog.push(`${'  '.repeat(depth)}✓ FIRST SENSOR placed at Bus ${nextBus} (just outside 300m)`);
                traversePath(nextBus, 0, nextBus, depth + 1, pathLog, false);
            }
            // Case 2: Interval reached — place sensor if outside 300m
            else if (newPoleCount >= interval) {
                if (isOutside300m) {
                    allSensors.push(nextBus);
                    sensorIntervals.push(newPoleCount);
                    pathLog.push(`${'  '.repeat(depth)}✓ INTERVAL SENSOR placed at Bus ${nextBus} (after ${newPoleCount} poles)`);
                    traversePath(nextBus, 0, nextBus, depth + 1, pathLog, false);
                } else {
                    pathLog.push(`${'  '.repeat(depth)}⊘ Skipped Bus ${nextBus} (within 300m of substation)`);
                    traversePath(nextBus, newPoleCount, lastSensorBus, depth + 1, pathLog, false);
                }
            }
            // Case 3: Not enough poles yet, keep going
            else {
                traversePath(nextBus, newPoleCount, lastSensorBus, depth + 1, pathLog, needsFirstSensor);
            }
        }
        
        // End of path - place sensor if not already placed
        if (!hasUnvisitedEnergizedNeighbors && polesSinceLastSensor > 0) {
            if (currentBus !== lastSensorBus && getSubstationForBus(currentBus) === null) {
                allSensors.push(currentBus);
                sensorIntervals.push(polesSinceLastSensor);
                pathLog.push(`${'  '.repeat(depth)}✓ END SENSOR placed at Bus ${currentBus} (after ${polesSinceLastSensor} poles)`);
            }
        }
    }
    
    // Track sensors per substation
    const sensorsPerSubstation = new Map();
    
    // Explore from each substation
    let substationCount = 0;
    for (const substationBus of substationBuses) {
        substationCount++;
        const pathLog = [];
        
        pathLog.push(`\n=== SUBSTATION ${substationCount} (Bus ${substationBus}) ===`);
        
        const outgoingEdges = adj.get(substationBus) || [];
        const energizedOutgoing = outgoingEdges.filter(({ to }) => energizedStatus.get(to) === 1);
        
        pathLog.push(`Found ${energizedOutgoing.length} energized outgoing paths`);
        
        let sensorsAtThisSubstation = 0;
        
        // For each outgoing path
        for (const { to: nextBus, lineIdx } of energizedOutgoing) {
            if (visitedEdges.has(lineIdx)) {
                pathLog.push(`  Path to Bus ${nextBus} already visited`);
                continue;
            }
            
            visitedEdges.add(lineIdx);
            
            const poleCount = countPolesBetweenBuses(substationBus, nextBus, busGeoMap, poles);
            pathLog.push(`  Line ${lineIdx} (Bus ${substationBus} → Bus ${nextBus}): ${poleCount} poles`);
            
            // Place first sensor at the first bus outside 300m of the substation
            if (getSubstationForBus(nextBus) === null) {
                // nextBus is outside 300m — place first sensor here
                allSensors.push(nextBus);
                sensorIntervals.push(0);
                sensorsAtThisSubstation++;
                pathLog.push(`  ✓ FIRST SENSOR placed at Bus ${nextBus} (just outside 300m)`);
                traversePath(nextBus, 0, nextBus, 2, pathLog, false);
            } else {
                // nextBus is within 300m — keep walking, flag needsFirstSensor=true
                pathLog.push(`  ⊘ Bus ${nextBus} within 300m, walking forward to find first sensor location...`);
                traversePath(nextBus, poleCount, substationBus, 2, pathLog, true);
            }
        }
        
        sensorsPerSubstation.set(substationBus, sensorsAtThisSubstation);
        pathLog.push(`  Total sensors at this substation: ${sensorsAtThisSubstation}`);
        
        traversalLog.push(...pathLog);
    }
    
    // ─── Pass 2: Cover any remaining energized edges not reached from substations ───
    let extraPathCount = 0;
    for (const [busId, neighbors] of adj.entries()) {
        if (energizedStatus.get(busId) !== 1) continue;
        
        for (const { to: nextBus, lineIdx } of neighbors) {
            if (visitedEdges.has(lineIdx)) continue;
            if (energizedStatus.get(nextBus) !== 1) continue;
            
            extraPathCount++;
            const pathLog = [];
            pathLog.push(`\n=== EXTRA PATH ${extraPathCount} (Line ${lineIdx}: Bus ${busId} ↔ Bus ${nextBus}) ===`);
            
            visitedEdges.add(lineIdx);
            
            const poleCount = countPolesBetweenBuses(busId, nextBus, busGeoMap, poles);
            pathLog.push(`  Line ${lineIdx}: ${poleCount} poles`);
            
            // Place start sensor only if outside 300m
            if (getSubstationForBus(busId) === null) {
                allSensors.push(busId);
                sensorIntervals.push(0);
                pathLog.push(`  ✓ START SENSOR placed at Bus ${busId}`);
                traversePath(nextBus, poleCount, busId, 1, pathLog);
            } else {
                pathLog.push(`  ⊘ Bus ${busId} within 300m, skipping start sensor`);
                traversePath(nextBus, poleCount, null, 1, pathLog);
            }
            
            traversalLog.push(...pathLog);
        }
    }
    
    // ─── Edge coverage diagnostics ───
    let totalEnergizedEdges = 0;
    let visitedEnergizedEdges = 0;
    const missedEdges = [];
    const seenEdgeIds = new Set();
    
    for (const [busId, neighbors] of adj.entries()) {
        for (const { to: nextBus, lineIdx } of neighbors) {
            if (seenEdgeIds.has(lineIdx)) continue; // each edge appears twice in adj
            seenEdgeIds.add(lineIdx);
            
            const fromLive = energizedStatus.get(busId) === 1;
            const toLive = energizedStatus.get(nextBus) === 1;
            
            if (fromLive && toLive) {
                totalEnergizedEdges++;
                if (visitedEdges.has(lineIdx)) {
                    visitedEnergizedEdges++;
                } else {
                    missedEdges.push({ lineIdx, from: busId, to: nextBus });
                }
            }
        }
    }
    
    if (missedEdges.length > 0) {
        console.warn(`  ⚠️ ${missedEdges.length} energized edges MISSED:`);
        missedEdges.forEach(e => console.warn(`    Line ${e.lineIdx}: Bus ${e.from} → Bus ${e.to}`));
    }
    
    // Calculate duplicates - count sensors in each substation area
    const sensorsPerSubstationArea = new Map(); // substationIndex -> Set of sensor busIds
    const sensorToSubstation = new Map(); // busId -> substationIndex
    
    for (const busId of allSensors) {
        const substationIdx = getSubstationForBus(busId);
        if (substationIdx !== null) {
            if (!sensorsPerSubstationArea.has(substationIdx)) {
                sensorsPerSubstationArea.set(substationIdx, new Set());
            }
            sensorsPerSubstationArea.get(substationIdx).add(busId);
            sensorToSubstation.set(busId, substationIdx);
        }
    }
    
    // Count duplicates: for each substation area, we need only 1 sensor, rest are duplicates
    let duplicateSensors = 0;
    for (const [substationIdx, sensorSet] of sensorsPerSubstationArea.entries()) {
        if (sensorSet.size > 1) {
            duplicateSensors += (sensorSet.size - 1); // All but one are duplicates
        }
    }
    
    // Track which buses are duplicates (not the first one in each substation area)
    const duplicateBuses = new Set();
    for (const [substationIdx, sensorSet] of sensorsPerSubstationArea.entries()) {
        if (sensorSet.size > 1) {
            const sensorsArray = Array.from(sensorSet);
            // Mark all except the first as duplicates
            for (let i = 1; i < sensorsArray.length; i++) {
                duplicateBuses.add(sensorsArray[i]);
            }
        }
    }
    
    // Create unique sensor list
    const uniqueSensors = [];
    const uniqueIntervals = [];
    const seenBuses = new Set();
    
    for (let i = 0; i < allSensors.length; i++) {
        if (!seenBuses.has(allSensors[i])) {
            uniqueSensors.push(allSensors[i]);
            uniqueIntervals.push(sensorIntervals[i]);
            seenBuses.add(allSensors[i]);
        }
    }
    
    // Calculate metrics
    const k = uniqueSensors.length;
    const systemResolution = k > 0 ? N / k : 0;
    
    const spanGaps = [];
    for (let i = 0; i < uniqueSensors.length - 1; i++) {
        const [lon1, lat1] = busGeoMap.get(uniqueSensors[i]) || [0, 0];
        const [lon2, lat2] = busGeoMap.get(uniqueSensors[i + 1]) || [0, 0];
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
        totalSensorsBeforeDedup: allSensors.length,
        systemResolution: systemResolution,
        maxSpanGap: maxSpanGap,
        avgSpanGap: avgSpanGap,
        interval: interval,
        strategicSensors: substationBuses.size,
        intervalSensors: k - substationBuses.size,
        duplicateSensorsAtSubstations: duplicateSensors,
        duplicateBuses: Array.from(duplicateBuses), // List of bus IDs that are duplicates
        traversalLog: traversalLog
    };
    
    return {
        sensors: uniqueSensors,
        poleIndices: [],
        intervals: uniqueIntervals,
        metrics: metrics
    };
}

/**
 * Read sensor status from energized map.
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
 */
export function identifyFaultyInterval(sensors, sensorReadings) {
    for (let i = 0; i < sensors.length; i++) {
        const status = sensorReadings.get(sensors[i]) || 0;
        if (status === 0) {
            return i;
        }
    }
    return -1;
}

export function identifyFaultyBlock(sensors, sensorReadings) {
    return identifyFaultyInterval(sensors, sensorReadings);
}
