/**
 * Sensor Placement Engine
 * 
 * Implements the √n optimal sensor placement strategy.
 * Runs entirely client-side for real-time interaction.
 */

/**
 * DFS preorder traversal from source.
 * @param {Map} adj - adjacency list
 * @param {Array} sources - list of source nodes
 * @param {Array} allBuses - list of all buses (fallback)
 * @returns {Array} ordering of nodes
 */
function dfsPreorder(adj, sources, allBuses) {
    const visited = new Set();
    const order = [];

    // Helper to traverse from a specific node
    function traverse(startNode) {
        if (visited.has(startNode)) return;

        const stack = [startNode];
        while (stack.length > 0) {
            const node = stack.pop();

            if (visited.has(node)) continue;
            visited.add(node);
            order.push(node);

            const neighbors = (adj.get(node) || []).map(n => n.to);
            // Reverse so we process in consistent order (right-to-left push = left-to-right pop)
            for (let i = neighbors.length - 1; i >= 0; i--) {
                if (!visited.has(neighbors[i])) {
                    stack.push(neighbors[i]);
                }
            }
        }
    }

    // 1. Traverse from all identified sources
    const sourceArray = Array.isArray(sources) ? sources : [sources];
    for (const source of sourceArray) {
        traverse(source);
    }

    // 2. Fallback: Traverse any remaining unvisited nodes (should be covered by sources if computed correctly)
    if (allBuses) {
        for (const bus of allBuses) {
            if (!visited.has(bus)) {
                traverse(bus);
            }
        }
    }

    return order;
}

/**
 * Place √n sensors using DFS ordering.
 * @param {Map} adj - adjacency list
 * @param {number|number[]} sources - ext_grid bus or list of sources
 * @param {Array} allBuses - all bus IDs in the region
 * @returns {{ sensors: number[], blocks: number[][] }}
 */
export function placeSensorsSqrtN(adj, sources, allBuses) {
    // Get ordering from source(s) using DFS
    const ordering = dfsPreorder(adj, sources, allBuses);
    const n = ordering.length;

    if (n === 0) return { sensors: [], blocks: [] };
    if (n === 1) {
        // If only one bus, place one sensor on it
        return { sensors: [ordering[0]], blocks: [[ordering[0]]] };
    }

    const k = Math.ceil(Math.sqrt(n));
    const blocks = [];
    for (let i = 0; i < n; i += k) {
        blocks.push(ordering.slice(i, i + k));
    }

    // Place sensor at the last bus of each block
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
