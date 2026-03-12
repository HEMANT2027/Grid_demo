# Test Sample Files Guide

This directory contains sample files to test the Infrastructure Planner import logic.

## CSV Test Files

### 1. test_sample_simple.csv
**Purpose**: Basic connectivity test
- 2 substations (220kV)
- 1 intermediate pole (132kV)
- 2 transmission lines connecting them in series
**Expected Result**: Simple linear topology with 3 nodes and 2 edges

### 2. test_sample_comprehensive.csv
**Purpose**: Multi-voltage level test
- 2 main substations (220kV)
- 2 poles (132kV)
- 2 towers (400kV)
- 1 bus node (132kV)
- 7 transmission lines at different voltage levels
**Expected Result**: Complex network with parallel 132kV and 400kV paths

### 3. test_sample_complex.csv
**Purpose**: Large-scale grid topology test
- 5 substations at different voltage levels (400kV, 220kV, 132kV)
- Multiple towers and poles creating radial distribution
- Bus junctions for network branching
- 26 total transmission lines
**Expected Result**: Star topology with central substation connecting to 4 regional substations

## GeoJSON Test Files

### 1. test_sample_simple.geojson
**Purpose**: Basic GeoJSON parsing
- 2 substations
- 1 pole
- 1 LineString that creates intermediate vertices
**Expected Result**: Parser should snap LineString vertices to existing nodes

### 2. test_sample_comprehensive.geojson
**Purpose**: Multi-path LineString test
- 2 substations
- 2 towers
- 2 LineStrings (one at 132kV, one at 400kV) with intermediate vertices
**Expected Result**: Parser creates intermediate pole nodes for LineString vertices

### 3. test_sample_osm_style.geojson
**Purpose**: OpenStreetMap compatibility test
- Uses OSM-style IDs (@id, osmid)
- Mixed ID formats
- Points without explicit IDs (should auto-generate)
- LineStrings with voltage metadata
**Expected Result**: Parser handles all OSM ID formats and generates IDs where missing

### 4. test_large_grid.geojson
**Purpose**: Large-scale realistic power grid topology test
- 15 substations at various voltage levels (400kV, 220kV, 132kV)
- 36 transmission towers (400kV backbone)
- 120 distribution poles (220kV and 132kV)
- 10 bus junctions
- 40+ LineStrings creating a complex interconnected mesh network
- Total: 250+ nodes covering a metropolitan area
**Expected Result**: 
- Complete metropolitan grid with central 400kV ring
- Radial 220kV distribution to regional substations
- 132kV local distribution networks
- Multiple redundant paths for reliability
- Realistic topology with industrial, commercial, residential, and special zones (airport, tech park)

## Testing Checklist

For each file, verify:
- [ ] File imports without errors
- [ ] All nodes appear on the map at correct coordinates
- [ ] Node types are correctly identified (substation/pole/tower/bus)
- [ ] Voltage levels are correctly parsed
- [ ] All edges connect the correct source and target nodes
- [ ] LineStrings create intermediate nodes correctly
- [ ] No duplicate nodes or edges
- [ ] Topology is visually correct on the map

## Common Issues to Check

1. **CSV Parsing**:
   - Empty columns should be handled gracefully
   - Quoted values should be stripped correctly
   - Mixed node/edge rows should parse correctly

2. **GeoJSON Parsing**:
   - LineString vertices should snap to nearby nodes (within 0.0001 degrees)
   - Missing IDs should auto-generate
   - OSM-style properties (@id, osmid) should be recognized

3. **Topology**:
   - No orphaned nodes (nodes without connections)
   - No dangling edges (edges referencing non-existent nodes)
   - Voltage levels should be consistent along paths
