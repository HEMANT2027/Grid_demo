/**
 * Grid Simulation Engine
 * 
 * Client-side graph simulation using BFS/DFS.
 * Builds an adjacency list from line data and computes
 * energization status via graph reachability.
 */

/**
 * Build adjacency list from line data.
 * @param {Array} lines - [[idx, from, to, kv, name], ...]
 * @returns {Map<number, Array<{to: number, lineIdx: number}>>}
 */
export function buildAdjacencyList(lines) {
    const adj = new Map();
    // Handle both 4-element and 5-element line arrays
    // Format: [id, source, target, voltage, name?]
    for (const line of lines) {
        const idx = line[0];
        const from = line[1];
        const to = line[2];
        
        if (from == null || to == null) continue; // Skip invalid lines
        
        if (!adj.has(from)) adj.set(from, []);
        if (!adj.has(to)) adj.set(to, []);
        adj.get(from).push({ to, lineIdx: idx });
        adj.get(to).push({ to: from, lineIdx: idx });
    }
    return adj;
}

/**
 * BFS from source(s) through active edges only.
 * @param {Map} adj - adjacency list
 * @param {number|number[]} sources - source bus ID or array of IDs
 * @param {Set<number>} disabledLines - set of faulted line indices
 * @returns {Set<number>} reachable bus IDs
 */
export function bfsFromSources(adj, sources, disabledLines) {
    const visited = new Set();
    const queue = [];

    // Eliminate duplicate sources or invalid ones
    const sourceArray = Array.isArray(sources) ? sources : [sources];
    
    for (const s of sourceArray) {
        if (adj.has(s)) {
            visited.add(s);
            queue.push(s);
        } else if (adj.size > 0) {
            // Warn only if map is not empty (empty map means no data yet)
            console.warn(`Source bus ${s} not found in adjacency list`);
            // We usually add it to visited anyway so it shows as "live" (isolated node)
            visited.add(s); 
        }
    }

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = adj.get(current) || [];
        for (const { to, lineIdx } of neighbors) {
            if (!visited.has(to) && !disabledLines.has(lineIdx)) {
                visited.add(to);
                queue.push(to);
            }
        }
    }
    return visited;
}

/**
 * Find all disconnected components and assign a virtual source to each.
 * @param {Map} adj - adjacency list
 * @param {number[]} allBuses - all bus IDs
 * @param {number} primarySource - The main grid source
 * @returns {number[]} list of source IDs (one per component)
 */
export function findAllSources(adj, allBuses, primarySource) {
    const visited = new Set();
    const sources = [];

    // Helper for component traversal
    // We use a simple BFS/DFS here just to mark visited
    function traverseComponent(startNode) {
        const queue = [startNode];
        visited.add(startNode);
        while (queue.length > 0) {
            const u = queue.shift();
            const neighbors = adj.get(u) || [];
            for (const { to } of neighbors) {
                if (!visited.has(to)) {
                    visited.add(to);
                    queue.push(to);
                }
            }
        }
    }

    // 1. Start with primary source
    if (primarySource != null && allBuses.includes(primarySource)) {
        sources.push(primarySource);
        traverseComponent(primarySource);
    }

    // 2. Iterate all buses to find other components
    for (const bus of allBuses) {
        if (!visited.has(bus)) {
            // Found a new unvisited component
            // If it has edges (in adj), it's a subgraph. If not, it's an isolated node.
            // In either case, treating it as a source makes it "live".
            sources.push(bus);
            traverseComponent(bus);
        }
    }

    console.log(`Included ${sources.length} sources (components) to ensure full energization.`);
    return sources;
}

/**
 * Get energized status for all buses.
 * @param {Map} adj - adjacency list
 * @param {number|number[]} sources - source bus ID(s)
 * @param {Set<number>} disabledLines - set of faulted line indices
 * @param {Array} allBuses - list of all bus IDs
 * @returns {Map<number, number>} busId -> 1 (live) or 0 (dead)
 */
export function getEnergizedStatus(adj, sources, disabledLines, allBuses) {
    const reachable = bfsFromSources(adj, sources, disabledLines);
    const status = new Map();
    for (const busId of allBuses) {
        status.set(busId, reachable.has(busId) ? 1 : 0);
    }
    return status;
}

/**
 * Find bridge edges using Tarjan's algorithm.
 * Handles multigraphs (parallel lines) by tracking edge IDs.
 */
export function findBridges(adj, lines) {
    const visited = new Set();
    const disc = new Map();
    const low = new Map();
    const bridges = [];
    let timer = 0;

    function dfs(u, parentLineIdx) {
        visited.add(u);
        disc.set(u, timer);
        low.set(u, timer);
        timer++;

        const neighbors = adj.get(u) || [];
        for (const { to: v, lineIdx } of neighbors) {
            if (lineIdx === parentLineIdx) continue; // Don't go back up the same edge

            if (visited.has(v)) {
                low.set(u, Math.min(low.get(u), disc.get(v)));
            } else {
                dfs(v, lineIdx);
                low.set(u, Math.min(low.get(u), low.get(v)));
                if (low.get(v) > disc.get(u)) {
                    bridges.push(lineIdx);
                }
            }
        }
    }

    // To handle disconnected graph, we must run DFS on all components
    for (const node of adj.keys()) {
        if (!visited.has(node)) {
            dfs(node, -1);
        }
    }

    return bridges;
}

/**
 * Find a good bridge fault — one that disconnects ~5-15% of buses.
 */
export function findGoodBridgeFault(adj, sources, lines, allBuses) {
    const rawBridges = findBridges(adj, lines);
    if (rawBridges.length === 0) return null;

    // Filter out bridges that don't actually disconnect (double check)
    // or that only disconnect the leaf itself (if we want bigger impact)
    const totalBuses = allBuses.length;
    const targetDisconnect = Math.floor(totalBuses * 0.10); // Aim for 10%

    let bestLine = null;
    let bestDiff = Infinity;
    let foundAny = false;

    // Prioritize bridges with significant impact
    // Random sample to keep it fast
    const sample = rawBridges.length > 50
        ? rawBridges.sort(() => Math.random() - 0.5).slice(0, 50)
        : rawBridges;

    for (const lineIdx of sample) {
        const disabled = new Set([lineIdx]);
        // Check reachability from ALL sources
        const reachable = bfsFromSources(adj, sources, disabled);
        const disconnected = totalBuses - reachable.size;

        // Must disconnect at least 1 node
        if (disconnected > 0) {
            foundAny = true;
            const diff = Math.abs(disconnected - targetDisconnect);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestLine = lineIdx;
            }
        }
    }

    // If we found a bridge with impact, return it.
    // Otherwise fallback to first raw bridge (maybe it disconnects just 1 node)
    return bestLine !== null ? bestLine : (foundAny ? rawBridges[0] : null);
}
