/**
 * Sensor Placement Engine
 * 
 * Implements the √n optimal sensor placement strategy.
 * Runs entirely client-side for real-time interaction.
 */

/**
 * Traverse the full graph (all components) to creating a linear ordering of buses.
 * This ensures we consider every bus for sensor placement, not just those reachable from a source.
 * 
 * @param {Map} adj - Adjacency list
 * @param {number[]} allBuses - List of all bus IDs
 * @returns {number[]} Ordered list of all buses
 */
function traverseFullGraph(adj, allBuses) {
    const visited = new Set();
    const ordering = [];

    // Sort allBuses just to be deterministic
    // (Optional, but good for consistent results across runs)
    // Actually, assuming allBuses is stable is fine.

    // Helper: Iterative DFS
    function dfs(startNode) {
        const stack = [startNode];
        while (stack.length > 0) {
            const node = stack.pop();
            if (visited.has(node)) continue;
            visited.add(node);
            ordering.push(node);

            const neighbors = (adj.get(node) || []).map(n => n.to);
            // Reverse to process in natural order
            for (let i = neighbors.length - 1; i >= 0; i--) {
                if (!visited.has(neighbors[i])) {
                    stack.push(neighbors[i]);
                }
            }
        }
    }

    // Visit every bus
    for (const bus of allBuses) {
        if (!visited.has(bus)) {
            dfs(bus);
        }
    }

    return ordering;
}

/**
 * Place sensors ensuring FULL coverage and EXACT count if possible.
 * 
 * @param {Map} adj - adjacency list
 * @param {number[]} allBuses - Array of all bus IDs (required for full graph coverage)
 * @param {number} targetCount - Exact number of sensors to place
 * @returns {{ sensors: number[], blocks: number[][] }}
 */
export function placeSensorsSqrtN(adj, allBuses, targetCount) {
    if (!adj || !allBuses || allBuses.length === 0) return { sensors: [], blocks: [] };

    const ordering = traverseFullGraph(adj, allBuses);
    const n = ordering.length;

    let T = targetCount;

    // Sanity checks
    if (!T || T < 1) T = 1;
    if (T > n) T = n; // Cannot place more sensors than we have buses

    const blocks = [];
    // Partition n buses into T blocks exactly
    // We use a precise partitioning: indices [floor(i*n/T), floor((i+1)*n/T))
    for (let i = 0; i < T; i++) {
        const start = Math.floor((i * n) / T);
        const end = Math.floor(((i + 1) * n) / T);
        // Ensure strictly non-empty blocks if n >= T (which implies n/T >= 1)
        // If n < T, some blocks might be empty, but we capped T at n above.

        const block = ordering.slice(start, end);
        if (block.length > 0) {
            blocks.push(block);
        }
    }

    // Place sensor at the 'end' of each block (topologically downstream within the block traversal)
    // This heuristic is good for fault isolation.
    const sensors = blocks.map(block => block[block.length - 1]);

    return { sensors, blocks };
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
 * Find the first dead sensor's block index.
 * @returns {number} block index or -1
 */
export function identifyFaultyBlock(sensors, sensorReadings) {
    for (let i = 0; i < sensors.length; i++) {
        if ((sensorReadings.get(sensors[i]) || 0) === 0) {
            return i;
        }
    }
    return -1;
}
