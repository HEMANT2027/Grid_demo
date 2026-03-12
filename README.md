# Power Grid Simulation & Visualization Platform

A comprehensive real-time smart grid visualization and simulation platform for India's high-voltage transmission network. This project provides advanced tools for grid topology mapping, fault simulation, intelligent sensor placement, and energization analysis using real-world infrastructure data from PostgreSQL/PostGIS.

## 🌟 Features

### Core Capabilities
- **Real-time Visualization**: Interactive Leaflet map displaying transmission lines, substations, towers, and poles with voltage-based color coding
- **Grid Simulation**: Energize/de-energize grid segments with BFS-based power flow simulation
- **Fault Analysis**: Inject faults into transmission lines and visualize cascading impacts with bridge fault detection
- **Intelligent Sensor Placement**: Interval-based sensor placement (L=50 poles) with strategic positioning at substations and path endpoints
- **Sensor Predictor**: Client-side estimation tool that predicts sensor counts using Rules R1–R3 (Feeder Exit, DFS Interval, Dead-end) with research-backed formulations
- **Infrastructure Planner**: Standalone tool for defining grid topology via PostGIS Search & Clip, Manual Drawing, and File Import (GeoJSON/CSV).
- **Substation-Based Power Sources**: Uses actual substation locations as power sources instead of virtual nodes
- **Geographic Area Selection**: Select specific regions for focused analysis

### Advanced Features
- **Interval-Based Sensor System**: Places sensors every L poles with strategic placement at:
  - One sensor per substation (power source monitoring)
  - Endpoint sensors at DFS path terminals
  - Regular interval sensors for comprehensive coverage
- **Sensor Metrics Dashboard**: Real-time display of:
  - Total Poles (N)
  - Sensors Placed (k)
  - System Resolution (N/k)
  - Max/Avg Span Gap (Haversine distance)
  - Strategic vs Interval sensor breakdown
- **Fault Isolation**: Identifies specific L-pole intervals between last alive and first dead sensor
- **Smart Filtering**: Hides dead-from-start wires while showing fault-affected lines
- **Premium UI**: Modern dark-mode interface with responsive design

## 📁 Project Structure

```
Grid_demo/
├── dashboard/                    # React + Vite + Leaflet frontend
│   ├── src/
│   │   ├── pages/               # Application pages
│   │   │   ├── LandingPage.jsx  # Marketing landing page
│   │   │   ├── DashboardPage.jsx # Display-only grid view
│   │   │   ├── SimulationPage.jsx # Full simulation environment
│   │   │   ├── SensorPredictorPage.jsx # Sensor count estimator (R1–R3)
│   │   │   └── InfrastructurePlannerPage.jsx # New grid definition tool
│   │   ├── components/          # Reusable UI components
│   │   │   ├── MapView.jsx      # Leaflet map with layers
│   │   │   ├── ControlPanel.jsx # Simulation controls
│   │   │   ├── SensorPanel.jsx  # Sensor status display
│   │   │   └── StatusBar.jsx    # Grid statistics
│   │   ├── planner/             # Infrastructure Planner logic
│   │   │   ├── PlannerMap.jsx   # Dedicated plotting component
│   │   │   ├── plannerEngine.js # Isolated topology algorithms
│   │   │   ├── fileParser.js    # GeoJSON/CSV ingestion
│   │   │   └── IMPORT_SCHEMA_GUIDE.md # Schema documentation
│   │   ├── simulation/          # Simulation engines
│   │   │   ├── gridEngine.js    # Graph algorithms (BFS, DFS, Tarjan)
│   │   │   └── sensorEngine.js  # Interval-based sensor placement
│   │   └── index.css            # Global styles
│   ├── vite.config.js           # Vite configuration with proxy
│   └── package.json             # Frontend dependencies
├── core/                        # Python backend (Flask + PostgreSQL)
│   ├── api_server.py            # Flask REST API
│   ├── db_connection.py         # PostgreSQL connection pooling
│   ├── db_loader.py             # Spatial data queries
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment variables template
│   └── DB_SETUP_GUIDE.md        # Database setup instructions
├── FUNCTION_DOCUMENTATION.md    # Detailed function documentation
└── README.md                    # This file
```

## 🚀 Getting Started

### Prerequisites

**Backend:**
- Python 3.8+
- PostgreSQL 14+ with PostGIS extension
- pgRouting extension

**Frontend:**
- Node.js 18+
- npm or yarn

### Installation

#### 1. Database Setup

```bash
# Install PostgreSQL with PostGIS
# Follow instructions in core/DB_SETUP_GUIDE.md

# Create database
createdb grid_db

# Enable extensions
psql grid_db -c "CREATE EXTENSION postgis;"
psql grid_db -c "CREATE EXTENSION pgrouting;"

# Import schema and data
psql grid_db < core/FinalSchema.sql
```

#### 2. Backend Setup

```bash
cd core

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start API server
python api_server.py
```

The API will be available at `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## 📖 Usage

### Dashboard Page (Display Only)
1. Navigate to `/dashboard`
2. View the complete India power grid
3. Explore transmission lines colored by voltage
4. View substations and infrastructure

### Simulation Page (Full Features)
1. Navigate to `/simulation`
2. **Select Area** (optional): Draw a rectangle to focus on a specific region
3. **Energize Grid**: Click to power up the grid from substations
4. **Deploy Sensors**: Places sensors every 50 poles with strategic positioning
5. **Trigger Fault**: Inject random or bridge faults to test resilience
6. **Analyze Impact**: View affected lines, sensor readings, and fault isolation

### Sensor Predictor Page
1. Navigate to `/sensor-predictor`
2. Adjust sliders for graph topology (nodes, substations, dead-end %, etc.)
3. View estimated sensor counts across Rules R1–R3 in real-time
4. Analyze sensitivity to Recursive DFS interval L
5. Run coverage verification to confirm full grid observability
6. Export coverage reports
### Infrastructure Planner Page
1. Navigate to `/infrastructure-planner`
2. **Search & Clip**: Enter coordinate bounds or load the "Delhi NCR" preset to fetch real-world infrastructure from PostGIS.
3. **File Import**: Drag and drop `.geojson` or `.csv` files to import custom topologies.
4. **Drawing Mode**: Use the Polyline tool to draw transmission lines; vertices automatically become poles.
5. **Node Interactions**:
   - Toggle poles into substations by clicking them.
   - Manually place/remove sensors on specific towers.
6. **Execution**: Adjust the sensor interval (L) and click **🚀 Run Sensor Placement** to compute results.

The system uses a recursive DFS-based rule system:
- **R1 (Feeder Exit)**: One sensor per feeder leaving a substation cluster (IEC 61850)
- **R2 (DFS Interval)**: Sensor every L hops along recursive DFS paths (IEEE C37.118, CEA India)
- **R3 (Dead-end)**: Sensor at every terminal/leaf node (graph domination theory)
- **Deduplication**: Rules applied in order R1 → R3 → R2, no double-counting
- **Coverage guarantee**: Every node within L hops of the nearest sensor

### Fault Detection

When a fault occurs:
1. System identifies first dead sensor
2. Isolates fault to specific L-pole interval
3. Shows interval between last alive (S_i) and first dead (S_{i+1}) sensor
4. Displays number of poles in faulty interval

## 🔧 Configuration

### Backend (.env)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grid_db
DB_USER=postgres
DB_PASSWORD=your_password
API_HOST=localhost
API_PORT=5000
```

### Frontend (vite.config.js)
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  }
}
```

## 🎨 Key Technologies

**Frontend:**
- React 18 with Hooks
- Vite (build tool)
- Leaflet (mapping)
- Lucide React (icons)

**Backend:**
- Flask (REST API)
- PostgreSQL + PostGIS (spatial database)
- psycopg2 (database driver)
- python-dotenv (configuration)

**Algorithms:**
- BFS (Breadth-First Search) for energization
- DFS (Depth-First Search) for path finding
- Tarjan's Algorithm for bridge detection
- Haversine Formula for geographic distances
- Interval-Based Sampling for sensor placement

## 📊 API Endpoints

- `GET /api/grid-data` - Get all grid data (with optional region/voltage filters)
- `GET /api/grid-data/buses` - Get bus/vertex data
- `GET /api/grid-data/lines` - Get transmission lines
- `GET /api/grid-data/towers` - Get tower locations
- `GET /api/grid-data/poles` - Get pole locations
- `GET /api/grid-data/substations` - Get substation data
- `GET /api/health` - Health check

### Query Parameters
- `min_lon`, `min_lat`, `max_lon`, `max_lat` - Region bounds
- `min_voltage` - Minimum voltage filter (kV)
- `region` - Predefined region (e.g., 'delhi')

## 🤝 Contributing

This project is part of the Apparent Energy research initiative. For contributions or questions, please refer to the project documentation.

## 📄 License

This project is part of the Apparent Energy research initiative.

## 🔗 Additional Resources

- [Function Documentation](FUNCTION_DOCUMENTATION.md) - Detailed documentation of all functions
- [Database Setup Guide](core/DB_SETUP_GUIDE.md) - PostgreSQL/PostGIS setup instructions
- [Original Implementation](original/) - Legacy codebase for reference
- [Multi-Source Implementation](multisource/) - Alternative implementation

## 🎯 Future Enhancements

- Real-time data streaming
- Machine learning for fault prediction
- Multi-user collaboration
- Historical fault analysis
- Advanced routing algorithms
- Mobile responsive design improvements

---

**Built with ⚡ by the Apparent Energy Team**

