# Function Documentation

This document provides a comprehensive overview of all functions in the codebase, organized by file.

---

## Table of Contents

- [Frontend (Dashboard)](#frontend-dashboard)
  - [Pages](#pages)
  - [Components](#components)
  - [Simulation Engines](#simulation-engines)
- [Backend (Core)](#backend-core)
  - [API Server](#api-server)
  - [Database](#database)

---

## Frontend (Dashboard)

### Pages

#### `dashboard/src/main.jsx`

**Purpose**: Application entry point that sets up routing

- **`createRoot()`**: Initializes React root and renders the application with routing
  - Sets up BrowserRouter with three routes: Landing, Dashboard, and Simulation pages
  - Wraps app in StrictMode for development checks

---

#### `dashboard/src/pages/LandingPage.jsx`

**Purpose**: Marketing/landing page with navigation to main features

**Components:**

- **`LandingPage()`**: Main landing page component
  - Manages mount animation state
  - Renders hero section with animated title and CTA buttons
  - Displays feature grid with three main features
  - Handles navigation to dashboard and simulation pages

- **`Feature({ icon, title, desc, delay, mounted })`**: Reusable feature card component
  - Displays animated feature cards with icons
  - Accepts delay prop for staggered animations

**Helper Functions:**

- **`handleNavigate(path)`**: Opens specified path in new browser tab

---

#### `dashboard/src/pages/DashboardPage.jsx`

**Purpose**: Main dashboard for viewing and interacting with the full power grid

**State Management:**

- **`useState()`**: Manages grid data, simulation state, layers, tile layer, fault isolation, toast messages, and sources

**Effects:**

- **`useEffect()`**: Loads grid data from API on component mount
  - Fetches from `/api/grid-data` endpoint
  - Builds adjacency list for graph operations
  - Identifies all power sources including virtual sources for disconnected components

**UI Handlers:**

- **`handleToggleLayer(key)`**: Toggles visibility of map layers
- **`showToast(msg)`**: Displays temporary notification message

---

#### `dashboard/src/pages/SimulationPage.jsx`

**Purpose**: Simulation lab with area selection for focused grid analysis

**Simulation Features**:

- **`handleEnergize()`**: Energizes the grid using BFS from all sources
  - Calculates energized status for all buses
  - Updates sensor readings if sensors are placed
  - Shows performance metrics in toast

- **`handleDeenergize()`**: De-energizes the grid
  - Resets energized status and clears fault information

- **`handlePlaceSensors()`**: Places √n sensors optimally across the grid
  - Uses DFS-based block partitioning
  - Updates sensor readings if grid is energized

- **`handleTriggerFault(lineIdx)`**: Triggers a fault on specified or random line
  - Recalculates energized status with disabled line
  - Identifies faulty block using sensor readings
  - Shows impact metrics

- **`handleBridgeFault()`**: Finds and triggers a bridge fault
  - Uses Tarjan's algorithm to find critical lines
  - Selects bridge that disconnects ~10% of buses
  - Triggers fault on selected bridge line

- **`handleRepairFault()`**: Repairs active fault
  - Recalculates status without disabled lines
  - Restores grid to normal operation

- **`handleReset()`**: Resets entire simulation to initial state

- **`loadGridData(regionBounds)`**: Loads grid data for specific geographic region
  - Accepts optional bounding box parameters
  - Resets simulation state when area changes

- **`handleToggleAreaSelection()`**: Toggles area selection mode on map

- **`handleAreaSelected(bounds)`**: Handles area selection completion
  - Receives bounding box from map
  - Triggers grid data reload for selected region

- **`handleSelectionCancel()`**: Cancels area selection mode

**Effects:**

- **`useEffect()`**: Reloads grid data when selected area changes
  - Resets simulation state
  - Calls loadGridData with new bounds

All other simulation functions are identical to DashboardPage.

---

### Components

#### `dashboard/src/components/StatusBar.jsx`

**Purpose**: Top status bar showing grid statistics and health metrics

- **`StatusBar({ gridData, simState })`**: Renders status bar with multiple metric cards
  - Calculates live/dead bus counts from energized status
  - Calculates live/dead sensor counts from sensor readings
  - Computes grid health percentage
  - Displays cards for: Grid Status, Network Stats, Health, Sensors, and Active Faults

---

#### `dashboard/src/components/ControlPanel.jsx`

**Purpose**: Left sidebar with simulation controls and settings

- **`ControlPanel({ ...props })`**: Renders control panel with multiple sections
  - **Quick Actions**: Energize/De-energize and Deploy Sensors buttons
  - **Fault Testing**: Bridge Fault, Random Fault, and Repair buttons
  - **Area Selection**: Select/Cancel area selection (SimulationPage only)
  - **Map Style**: Dark, Light, and Satellite tile options
  - **Map Layers**: Toggle visibility of lines, substations, towers, poles, sensors, and source
  - **Reset**: Reset simulation button

---

#### `dashboard/src/components/MapView.jsx`

**Purpose**: Interactive Leaflet map displaying the power grid

**Helper Functions:**

- **`getVoltageColor(kv)`**: Returns color code based on voltage level
  - Maps voltage ranges to specific colors (765kV+ = pink, 400kV = orange, etc.)

**Sub-Components:**

- **`TileLayerSwitcher({ tileLayer })`**: Dynamically switches map tile layers
  - Removes old layer and adds new one when tileLayer prop changes
  - Supports dark, light, and satellite tiles

- **`LineLayer({ gridData, simState, busGeoMap, isolateFault, onTriggerFault })`**: Renders transmission lines
  - Colors lines based on voltage when energized
  - Shows faulted lines with pulsing red animation
  - Shows affected (de-energized) lines in orange
  - Filters to show only fault-related lines when isolateFault is true
  - Handles click events to trigger faults on specific lines

- **`TowerLayer({ gridData })`**: Renders tower markers
  - Only visible at zoom level 9+
  - Samples towers at lower zoom levels for performance

- **`PoleLayer({ gridData })`**: Renders pole markers
  - Only visible at zoom level 10+
  - Samples poles at lower zoom levels for performance

- **`SubstationLayer({ gridData })`**: Renders substation markers
  - Shows voltage and name in tooltips

- **`SensorLayer({ simState, busGeoMap })`**: Renders sensor markers
  - Colors sensors green (live) or red (dead)
  - Shows sensor ID, bus ID, and status in tooltips

- **`SourceMarker({ gridData, busGeoMap })`**: Renders power source marker
  - Shows external grid bus location in purple

- **`ZoomTracker({ onZoomChange })`**: Tracks map zoom level
  - Calls callback on zoom changes

- **`AreaSelector({ isSelecting, onAreaSelected, onSelectionCancel })`**: Handles area selection
  - Enables rectangle drawing on map
  - Disables map dragging during selection
  - Converts drawn rectangle to API bounds format
  - Calls onAreaSelected with bounds when complete

- **`SelectedAreaOverlay({ bounds })`**: Shows persistent rectangle for selected area
  - Displays semi-transparent rectangle overlay

**Main Component:**

- **`MapView({ ...props })`**: Main map container
  - Builds bus geography lookup map
  - Calculates map center from bus locations
  - Renders all layers based on visibility settings
  - Shows loading state or empty map when no data
  - Displays zoom indicator and voltage legend

---

#### `dashboard/src/components/SensorPanel.jsx`

**Purpose**: Right sidebar showing sensor status and fault analysis

- **`SensorPanel({ simState })`**: Renders sensor panel
  - Shows empty state when no sensors placed
  - Displays sensor count and live/dead summary
  - Shows fault analysis section when fault is detected:
    - Last live sensor before fault
    - First dead sensor after fault
    - Fault isolation message
  - Lists all sensors with status, bus ID, and block size
  - Highlights faulty block

---

### Simulation Engines

#### `dashboard/src/simulation/gridEngine.js`

**Purpose**: Client-side graph algorithms for grid simulation

**Graph Building:**

- **`buildAdjacencyList(lines)`**: Builds bidirectional adjacency list from line data
  - Input: Array of lines `[id, source, target, voltage, name]`
  - Output: Map of bus ID to array of `{to, lineIdx}` neighbors
  - Creates undirected graph (adds edges in both directions)

**Graph Traversal:**

- **`bfsFromSources(adj, sources, disabledLines)`**: Breadth-first search from multiple sources
  - Input: Adjacency list, source bus ID(s), set of disabled line indices
  - Output: Set of reachable bus IDs
  - Skips edges in disabledLines set
  - Handles both single source and array of sources

**Component Detection:**

- **`findAllSources(adj, allBuses, primarySource)`**: Finds all disconnected components
  - Input: Adjacency list, all bus IDs, primary source ID
  - Output: Array of source IDs (one per component)
  - Starts with primary source, then finds additional components
  - Ensures all buses can be energized via virtual sources

**Energization:**

- **`getEnergizedStatus(adj, sources, disabledLines, allBuses)`**: Computes energized status for all buses
  - Input: Adjacency list, sources, disabled lines, all bus IDs
  - Output: Map of bus ID to status (1=live, 0=dead)
  - Uses BFS to find reachable buses from sources

**Bridge Detection:**

- **`findBridges(adj, lines)`**: Finds bridge edges using Tarjan's algorithm
  - Input: Adjacency list, lines array
  - Output: Array of bridge line indices
  - Handles disconnected graphs and multigraphs
  - Uses DFS with discovery and low-link values

- **`findGoodBridgeFault(adj, sources, lines, allBuses)`**: Finds impactful bridge fault
  - Input: Adjacency list, sources, lines, all bus IDs
  - Output: Line index of good bridge or null
  - Targets bridges that disconnect ~10% of buses
  - Samples up to 50 bridges for performance

---

#### `dashboard/src/simulation/sensorEngine.js`

**Purpose**: Optimal sensor placement using √n strategy

**Helper Functions:**

- **`dfsPreorder(adj, sources, allBuses)`**: DFS traversal from sources
  - Input: Adjacency list, source nodes, all bus IDs
  - Output: Array of bus IDs in DFS preorder
  - Traverses from all sources, then any remaining unvisited nodes
  - Uses stack-based iterative DFS

**Sensor Placement:**

- **`placeSensorsSqrtN(adj, sources, allBuses)`**: Places √n sensors optimally
  - Input: Adjacency list, sources, all bus IDs
  - Output: Object with `sensors` array and `blocks` array
  - Uses DFS ordering to partition grid into √n blocks
  - Places one sensor at end of each block

**Sensor Reading:**

- **`readSensors(sensors, energizedStatus)`**: Reads sensor status
  - Input: Sensor bus IDs, energized status map
  - Output: Map of sensor bus ID to status (0|1)

**Fault Detection:**

- **`identifyFaultyBlock(sensors, sensorReadings)`**: Finds first dead sensor
  - Input: Sensor array, sensor readings map
  - Output: Block index of first dead sensor, or -1
  - Used to isolate fault location between sensors

---

#### `dashboard/src/simulation/test_virtual_sources.js`

**Purpose**: Test suite for virtual sources logic

- **`runTest()`**: Runs comprehensive test suite
  - Creates mock disconnected grid with 2 components
  - Tests `findAllSources()` to verify 2 sources found
  - Tests normal energization (all buses should be live)
  - Tests fault injection (verifies correct buses go dead)
  - Exits with error code if any test fails

---

## Backend (Core)

### API Server

#### `core/api_server.py`

**Purpose**: Flask REST API for serving grid data from PostgreSQL

**Configuration:**

- Loads environment variables from `.env`
- Enables CORS for frontend requests
- Configurable host and port

**Endpoints:**

- **`get_grid_data()`**: `GET /api/grid-data`
  - Returns all grid data (buses, lines, towers, poles, substations)
  - Supports query parameters:
    - `min_lon`, `min_lat`, `max_lon`, `max_lat`: Region bounds
    - `min_voltage`: Minimum voltage filter
    - `region`: Predefined region name (e.g., 'delhi')
  - Returns JSON with grid data and statistics

- **`get_buses()`**: `GET /api/grid-data/buses`
  - Returns only bus/vertex data

- **`get_lines()`**: `GET /api/grid-data/lines`
  - Returns only transmission line data

- **`get_towers()`**: `GET /api/grid-data/towers`
  - Returns only tower location data

- **`get_poles()`**: `GET /api/grid-data/poles`
  - Returns only pole location data

- **`get_substations()`**: `GET /api/grid-data/substations`
  - Returns only substation data

- **`get_statistics()`**: `GET /api/grid-data/statistics`
  - Returns grid statistics (voltage distribution, connectivity, bounds)

- **`health_check()`**: `GET /api/health`
  - Tests database connection
  - Returns health status

**Error Handlers:**

- **`not_found(error)`**: Handles 404 errors
- **`internal_error(error)`**: Handles 500 errors

**Main:**

- Prints API information and starts Flask development server

---

### Database

#### `core/db_connection.py`

**Purpose**: PostgreSQL connection pooling and utilities

**Classes:**

- **`DatabaseConnection`**: Singleton connection pool manager
  - **`initialize_pool(minconn, maxconn)`**: Creates connection pool
    - Reads database credentials from environment variables
    - Creates SimpleConnectionPool with specified size
  
  - **`get_connection()`**: Gets connection from pool
    - Initializes pool if not already created
  
  - **`return_connection(connection)`**: Returns connection to pool
  
  - **`close_all_connections()`**: Closes all pooled connections

**Context Managers:**

- **`get_db_cursor(dict_cursor=True)`**: Context manager for database operations
  - Gets connection from pool
  - Creates cursor (RealDictCursor by default)
  - Handles commit/rollback
  - Returns connection to pool on exit
  - Usage: `with get_db_cursor() as cur: ...`

**Testing:**

- **`test_connection()`**: Tests database connectivity
  - Checks PostgreSQL version
  - Checks PostGIS version
  - Checks pgRouting version
  - Returns True if all tests pass

---

#### `core/db_loader.py`

**Purpose**: Loads grid data from PostgreSQL with spatial queries

**Class Methods:**

- **`GridDataLoader.load_buses(region_bounds, min_voltage)`**: Loads bus/vertex data
  - Input: Optional region bounds dict, optional min voltage
  - Output: List of `[id, lon, lat, voltage]`
  - Uses PostGIS ST_Intersects for region filtering
  - Transforms coordinates from EPSG:3857 to EPSG:4326

- **`GridDataLoader.load_lines(bus_ids, min_voltage)`**: Loads transmission line data
  - Input: Optional set of bus IDs, optional min voltage
  - Output: List of `[id, source, target, voltage, name]`
  - Filters lines to only include those connecting specified buses
  - Filters by minimum voltage if specified

- **`GridDataLoader.load_towers(region_bounds)`**: Loads tower locations
  - Input: Optional region bounds dict
  - Output: List of `[lon, lat]`
  - Uses PostGIS spatial filtering

- **`GridDataLoader.load_poles(region_bounds)`**: Loads pole locations
  - Input: Optional region bounds dict
  - Output: List of `[lon, lat]`
  - Filters for type='pole' in grid_points table

- **`GridDataLoader.load_substations(region_bounds)`**: Loads substation data
  - Input: Optional region bounds dict
  - Output: List of `[lon, lat, voltage, name]`
  - Uses ST_Centroid for polygon geometries

- **`GridDataLoader.find_external_grid_bus(buses)`**: Finds main power source
  - Input: Optional list of buses
  - Output: Bus ID of highest voltage bus
  - Falls back to database query if no buses provided

- **`GridDataLoader.load_all_grid_data(region_bounds, min_voltage)`**: Loads complete grid dataset
  - Input: Optional region bounds, optional min voltage
  - Output: Dictionary with all grid components and statistics
  - Coordinates loading of all data types
  - Prints summary statistics

- **`GridDataLoader.get_grid_statistics()`**: Gets comprehensive statistics
  - Output: Dictionary with voltage distribution, connectivity metrics, and geographic bounds
  - Queries database for aggregate statistics

---

## Summary

This codebase implements a full-stack power grid simulation and visualization system:

- **Frontend**: React application with interactive Leaflet maps, real-time simulation, and sensor placement
- **Ba