# Function Documentation - Simulation Page

This document describes the important functions in the SimulationPage component.

---

## SimulationPage Core Functions

### `handleEnergize()`

Energizes the grid using BFS (Breadth-First Search) from all power sources.

**Logic:**
1. Validates that adjacency list and grid data exist
2. Checks if power sources are identified (substations)
3. Calls `getEnergizedStatus()` with sources and no disabled lines
4. Counts live buses from the energized status map
5. Updates simulation state with energized status
6. If sensors are placed, updates their readings based on new energized status
7. Stores initial energized status for future fault comparisons
8. Displays performance metrics (time elapsed, buses energized)

---

### `handleDeenergize()`

De-energizes the entire grid and clears fault information.

**Logic:**
1. Resets energized status to null
2. Clears fault information
3. Clears sensor readings
4. Updates energized flag to false
5. Shows toast notification

---

### `handlePlaceSensors()`

Places sensors at strategic intervals along the power grid using pole/tower locations.

**Logic:**
1. Validates grid is energized before placing sensors
2. Builds bus geography map (bus ID → [lon, lat])
3. Uses poles/towers as potential sensor locations
4. Calls `placeSensorsIntervalBased()` with:
   - Pole locations
   - Bus geography map
   - Sensor interval (L = 50 poles by default)
   - Adjacency list for DFS traversal
   - Power sources
   - Substations for strategic placement
5. Filters out sensors on non-energized buses
6. Calculates sensor readings for energized sensors
7. Updates simulation state with sensor locations, intervals, and metrics
8. Displays placement statistics (count, strategic vs interval, filtered)

---

### `handleTriggerFault(lineIdx)`

Triggers a fault on a specific transmission line (click-to-fault only).

**Logic:**
1. Validates adjacency list and grid data exist
2. Requires lineIdx parameter (no random faults)
3. Finds the line object from grid data
4. Creates disabled lines set containing only the faulted line
5. Recalculates energized status with the disabled line
6. Creates fault info object with line details (index, from/to buses, voltage)
7. Counts dead buses after fault
8. If sensors are placed:
   - Updates sensor readings based on new energized status
   - Identifies faulty interval using `identifyFaultyInterval()`
9. Updates simulation state with new energized status and fault info
10. Displays fault impact metrics (line index, dead buses, time elapsed)

---

### `handleRepairFault()`

Repairs the active fault and restores grid to normal operation.

**Logic:**
1. Validates adjacency list and grid data exist
2. Recalculates energized status with no disabled lines (empty set)
3. Updates simulation state:
   - Sets energized flag to true
   - Updates energized status to fault-free state
   - Clears fault information
   - Resets faulty block index
   - Updates sensor readings if sensors are placed
4. Displays repair confirmation with time elapsed

---

### `handleReset()`

Resets the entire simulation to initial state.

**Logic:**
1. Resets simulation state to `INITIAL_SIM_STATE`:
   - energized: false
   - sensors: []
   - intervals: []
   - sensorMetrics: null
   - sensorReadings: null
   - energizedStatus: null
   - initialEnergizedStatus: null
   - faultInfo: null
   - faultyInterval: -1
   - repairMode: false
2. Disables fault isolation mode
3. Shows reset confirmation toast

---

### `loadGridData(regionBounds)`

Loads grid data from the backend API for a specific geographic region.

**Logic:**
1. Determines API URL (from environment variable or default)
2. Builds query string from region bounds if provided:
   - min_lon, min_lat, max_lon, max_lat
3. Fetches grid data from `/api/grid-data` endpoint
4. On success:
   - Updates grid data state
   - Builds adjacency list using `buildAdjacencyList()`
   - Extracts all bus IDs
   - Sets power sources from substation_sources
   - Displays load confirmation with statistics
5. On error:
   - Logs error to console
   - Shows error toast with details

---

### `handleToggleAreaSelection()`

Toggles the area selection mode on the map.

**Logic:**
1. Toggles `isSelectingArea` state
2. When enabled, map enters rectangle drawing mode
3. When disabled, exits drawing mode

---

### `handleAreaSelected(bounds)`

Handles completion of area selection on the map.

**Logic:**
1. Receives bounds object with min_lon, min_lat, max_lon, max_lat
2. Updates `selectedAreaBounds` state
3. Disables area selection mode
4. Shows toast notification
5. Triggers `useEffect` to reload grid data for selected area

---

### `handleSelectionCancel()`

Cancels the area selection process.

**Logic:**
1. Sets `isSelectingArea` to false
2. Exits rectangle drawing mode without saving bounds

---

### `useEffect` - Area Change Handler

Reloads grid data when the selected area changes.

**Logic:**
1. Watches `selectedAreaBounds` for changes
2. When bounds change:
   - Resets simulation state to initial
   - Disables fault isolation
   - Calls `loadGridData()` with new bounds
3. Dependencies: selectedAreaBounds, loadGridData

---

## Key State Variables

- **gridData**: Contains buses, lines, towers, poles, substations from API
- **simState**: Simulation state including energized status, sensors, faults
- **adjRef**: Reference to adjacency list (graph representation)
- **allBusesRef**: Reference to array of all bus IDs
- **sources**: Array of power source bus IDs (substations)
- **selectedAreaBounds**: Geographic bounds of selected area
- **sensorInterval**: Interval between sensors (L = 50 poles default)
