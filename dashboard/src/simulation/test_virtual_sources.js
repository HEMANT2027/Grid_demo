
import { buildAdjacencyList, findAllSources, getEnergizedStatus, bfsFromSources } from './gridEngine.js'; // Ensure correct import

console.log("=== Testing Virtual Sources Logic ===");

function runTest() {
    // 1. Setup Mock Data (Disconnected Grid)
    // Component A: 1 --(line 0)--> 2 --(line 1)--> 3
    // Component B: 4 --(line 2)--> 5
    // Format: [id, source, target, voltage, name]
    const lines = [
        [0, 1, 2, 132, 'Line A1'],
        [1, 2, 3, 132, 'Line A2'],
        [2, 4, 5, 33, 'Line B1']
    ];

    const allBuses = [1, 2, 3, 4, 5];
    const primarySource = 1; // Assume 1 is the "main" source

    console.log("Building adjacency list...");
    const adj = buildAdjacencyList(lines);

    // 2. Test findAllSources
    console.log("\n--- Testing FIND ALL SOURCES ---");
    // Since this is a test environment, make sure we call it correctly
    // The implementation of findAllSources uses Set and traversing
    const sources = findAllSources(adj, allBuses, primarySource);
    console.log("Sources found:", sources);

    // We expect 2 sources:
    // 1 (primary) covering {1,2,3}
    // 4 or 5 (virtual) covering {4,5}
    if (sources.length !== 2) {
        console.error("FAIL: Expected 2 sources, found " + sources.length);
        console.error("Sources: ", sources);
        process.exit(1);
    } else {
        console.log("PASS: Found 2 sources (one per component)");
    }

    // 3. Test Energization (Normal)
    console.log("\n--- Testing ENERGIZATION (Normal) ---");
    const disabled = new Set();
    const status = getEnergizedStatus(adj, sources, disabled, allBuses);

    let allLive = true;
    for (const bus of allBuses) {
        const s = status.get(bus);
        if (s !== 1) {
            console.error(`FAIL: Bus ${bus} is DEAD, expected LIVE`);
            allLive = false;
        }
    }

    if (allLive) {
        console.log("PASS: All buses energized via virtual sources");
    } else {
        process.exit(1);
    }

    // 4. Test Fault Injection
    console.log("\n--- Testing FAULT INJECTION ---");
    // Fault on Line 0 (1-2).
    // If Source is 1 (primary), then:
    // 1 is live.
    // 2 is unreachable from 1.
    // 3 is unreachable from 1 (via 2).
    // Component B (4-5) has its own source (say 4), so it stays live.
    // Note: If findAllSources picked 3 as source for component A (unlikely since we pass 1 as primary),
    // results would differ. But we pass primarySource=1, so it should be used.

    // We expect:
    // 1: Live (Source)
    // 2: Dead (Cut off)
    // 3: Dead (Cut off)
    // 4: Live (Other component)
    // 5: Live (Other component)

    const faultedLine = 0;
    disabled.add(faultedLine);
    console.log(`Fault on line ${faultedLine} (1->2)`);

    // Re-run energization
    const faultStatus = getEnergizedStatus(adj, sources, disabled, allBuses);

    const expected = {
        1: 1,
        2: 0,
        3: 0,
        4: 1,
        5: 1
    };

    let faultPass = true;
    for (const [bus, exp] of Object.entries(expected)) {
        const act = faultStatus.get(Number(bus));
        if (act !== exp) {
            console.error(`FAIL: Bus ${bus} status ${act}, expected ${exp}`);
            faultPass = false;
        }
    }

    if (faultPass) {
        console.log("PASS: Fault logic working correctly with virtual sources");
    } else {
        console.error("FAIL: Fault logic mismatch");
        process.exit(1);
    }
}

runTest();
