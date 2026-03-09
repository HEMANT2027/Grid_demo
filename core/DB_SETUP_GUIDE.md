# PostgreSQL Setup Guide

This guide explains how to set up PostgreSQL locally and **load a pre-built grid database from a `.dump` file**.

## Prerequisites

1. **PostgreSQL 12+** installed
2. **PostGIS 3.0+** extension
3. **pgRouting 3.0+** extension
4. **Python 3.8+**

## Step-by-Step Setup

### 1. Install PostgreSQL and Extensions

#### Windows:
```bash
# Download and install PostgreSQL from:
# https://www.postgresql.org/download/windows/

# Install PostGIS using Stack Builder (included with PostgreSQL installer)
# Or download from: https://postgis.net/windows_downloads/
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo apt install postgis postgresql-14-postgis-3
sudo apt install postgresql-14-pgrouting
```

#### macOS:
```bash
brew install postgresql
brew install postgis
brew install pgrouting
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE grid_db;

# Connect to the database
\c grid_db

# Enable extensions
CREATE EXTENSION postgis;
CREATE EXTENSION pgrouting;
CREATE EXTENSION postgis_topology;

# Verify extensions
SELECT PostGIS_Version();
SELECT pgr_version();

# Exit
\q
```

### 3. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your database credentials
# Windows: notepad .env
# Linux/macOS: nano .env
```

Update the following in `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grid_db
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

### 5. Load Grid Data from a `.dump` File (Recommended)

Instead of converting GeoJSON yourself, you can load a **pre-exported PostgreSQL dump** that already contains:

- All tables (`gridkit_vertices`, `gridkit_links`, towers, substations, etc.)
- All data for the grid
- All required constraints and indexes

Assume you have a file like `grid_db.dump` (or similar).

```bash
# From a terminal / PowerShell
cd /path/to/Grid_demo

# Drop existing DB if you want a clean restore (optional but recommended)
psql -U postgres -c "DROP DATABASE IF EXISTS grid_db;"
psql -U postgres -c "CREATE DATABASE grid_db;"

# Restore into the empty database
# Replace grid_db.dump with your actual dump file name
pg_restore -U postgres -d grid_db path/to/grid_db.dump
```

On Windows, make sure `pg_restore.exe` is on your PATH (e.g., `C:\Program Files\PostgreSQL\15\bin`), or call it with the full path.

Verify tables and row counts:

```bash
psql -U postgres -d grid_db -c "\dt"
psql -U postgres -d grid_db -c "SELECT COUNT(*) FROM gridkit_vertices;"
psql -U postgres -d grid_db -c "SELECT COUNT(*) FROM gridkit_links;"
```

### 6. Test Database Connection

```bash
# Test the connection
cd core
python db_connection.py
```

Expected output:
```
✓ PostgreSQL version: PostgreSQL 14.x...
✓ PostGIS version: 3.x...
✓ pgRouting version: 3.x...
✓ All database tests passed!
```

### 7. Start API Server

The frontend now fetches data directly from PostgreSQL via a Flask API server. No JSON export is needed.

```bash
# Navigate to core directory
cd core

# Start the API server
python api_server.py
```

The API server will start on `http://localhost:5000` by default. You can configure the host and port using environment variables:
```env
API_HOST=localhost
API_PORT=5000
```

**API Endpoints:**
- `GET /api/grid-data` - Get all grid data (buses, lines, towers, poles, substations)
- `GET /api/grid-data/buses` - Get buses only
- `GET /api/grid-data/lines` - Get lines only
- `GET /api/grid-data/towers` - Get towers only
- `GET /api/grid-data/poles` - Get poles only
- `GET /api/grid-data/substations` - Get substations only
- `GET /api/grid-data/statistics` - Get grid statistics
- `GET /api/health` - Health check

### 8. Start Dashboard

```bash
# Navigate to dashboard directory (in a new terminal)
cd dashboard

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The dashboard will automatically connect to the API server via the Vite proxy (configured in `vite.config.js`). The frontend fetches data from PostgreSQL in real-time - no JSON file needed!

Open browser to `http://localhost:5173` and verify the grid loads correctly.

> **Note on Performance:** By default, the dashboard is configured to only load the `delhi` region (`fetch('/api/grid-data?region=delhi')`) to prevent the browser from freezing while trying to render the entire India grid (1.5+ million nodes). You can remove this parameter in `SimulationPage.jsx` and `DashboardPage.jsx` when you are ready to load the full dataset.

```bash
# Navigate to dashboard
cd dashboard

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Open browser to `http://localhost:5173` and verify the grid loads correctly.

## Migration Checklist

- [ ] PostgreSQL installed and running
- [ ] PostGIS and pgRouting extensions enabled
- [ ] Database `grid_db` created
- [ ] Schema loaded from `FinalSchema.sql` **or** included in `.dump`
- [ ] Python dependencies installed
- [ ] `.env` file configured with database credentials
- [ ] Grid data loaded from `.dump` file into PostgreSQL
- [ ] (Optional) Grid data processed into network format (using `process_gridkit_data.py`, if needed)
- [ ] Database connection test passes
- [ ] API server starts successfully (using `api_server.py`)
- [ ] API health check passes (`GET /api/health`)
- [ ] Dashboard connects to API and displays grid correctly

## Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
# Windows:
services.msc  # Look for PostgreSQL service

# Linux:
sudo systemctl status postgresql

# Start if not running:
sudo systemctl start postgresql
```

### Authentication Failed
```bash
# Reset PostgreSQL password
sudo -u postgres psql
ALTER USER postgres PASSWORD 'new_password';
\q
```

### PostGIS Not Found
```bash
# Verify PostGIS installation
psql -U postgres -d grid_db -c "SELECT PostGIS_Version();"

# If not installed, install PostGIS extension
psql -U postgres -d grid_db -c "CREATE EXTENSION postgis;"
```

### Import / Restore Errors

#### "relation 'gridkit_vertices' does not exist"
This usually means the restore did not complete correctly, or the dump doesn’t contain the expected tables.

**Solution:**
```bash
# Recreate DB and restore again
psql -U postgres -c "DROP DATABASE IF EXISTS grid_db;"
psql -U postgres -c "CREATE DATABASE grid_db;"

pg_restore -U postgres -d grid_db path/to/grid_db.dump
```

#### Check table structure
```bash
# Check if tables exist
psql -U postgres -d grid_db -c "\dt"

# Check table structure
psql -U postgres -d grid_db -c "\d grid_lines"

# Check data
psql -U postgres -d grid_db -c "SELECT COUNT(*) FROM grid_lines;"
```

## Advanced Features

### Using pgRouting for Path Finding

```sql
-- Find shortest path between two substations
SELECT * FROM pgr_dijkstra(
    'SELECT id, source, target, ST_Length(geom) as cost FROM gridkit_links',
    start_vertex, end_vertex, directed := false
);
```

### Spatial Queries

```sql
-- Find all lines within 10km of a point
SELECT * FROM gridkit_links
WHERE ST_DWithin(
    geom,
    ST_Transform(ST_SetSRID(ST_MakePoint(77.5, 28.5), 4326), 3857),
    10000
);
```

### Performance Optimization

```sql
-- Analyze tables for query optimization
ANALYZE gridkit_links;
ANALYZE gridkit_vertices;

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

## Workflow Summary

The complete data pipeline (using a `.dump` file):

1. **Restore**: Load the provided PostgreSQL `.dump` into `grid_db`
2. **(Optional) Process**: `process_gridkit_data.py` - Creates/updates network structure (vertices, links, nodes)
3. **API Server**: `api_server.py` - Serves grid data from PostgreSQL to frontend
4. **Frontend**: React dashboard fetches data directly from API (no JSON export needed)

**Note:** Scripts like `import_geojson_to_db.py` are now optional/advanced and only needed if you want to build or modify the grid from raw GeoJSON.

## File Structure

```
core/
├── FinalSchema.sql              # Database schema definition
├── import_geojson_to_db.py      # (Optional) Import GeoJSON → PostgreSQL
├── process_gridkit_data.py      # (Optional) Process raw data → Network format
├── db_connection.py              # Database connection utilities
├── db_loader.py                 # Load data from PostgreSQL
├── api_server.py                # Flask API server (serves data to frontend)
├── export_grid_data_db.py       # [DEPRECATED] Export to JSON (optional)
└── requirements.txt             # Python dependencies
```

## Next Steps

1. **Build REST API** (optional): Create Flask/FastAPI endpoints for dynamic data access
2. **Real-time Updates**: Implement WebSocket for live fault simulation
3. **Advanced Analytics**: Use pgRouting for network analysis
4. **Backup Strategy**: Set up automated database backups

## Support

For issues or questions:
1. Check PostgreSQL logs: `/var/log/postgresql/` (Linux) or Event Viewer (Windows)
2. Verify PostGIS: `SELECT PostGIS_Full_Version();`
3. Test connection: `cd core && python db_connection.py`
