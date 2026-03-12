# Infrastructure Planner Import Schemas

The Infrastructure Planner supports importing custom grid topologies via **GeoJSON** and **CSV** files. The internal parser is designed to handle standard OpenStreetMap (OSM) data structures natively, making it easy to export from tools like Overpass Turbo or QGIS and drop them straight into the map.

## 1. GeoJSON Schema

The file must be a valid GeoJSON `FeatureCollection`.

### Nodes (Points)
Point geometries are strictly parsed as Grid Nodes (Substations or Poles/Towers).
*   **`geometry.type`**: Must be `"Point"`.
*   **`properties` parameters**:
    *   `id` or `@id` or `osmid` *(Optional)*: The unique ID. If omitted, a random one is generated.
    *   `power` *(Optional)*: Defines the node type. Accepts `"substation"`, `"pole"`, `"tower"`, or `"portal"`. 
    *   `voltage` *(Optional)*: Integer.
    *   `name` *(Optional)*: String name for tooltips.

### Transmission Lines (Edges)
Line geometries are converted into Edges. The parser handles topological routing automatically: if a LineString contains multiple vertex points, it automatically generates intermediate `pole` nodes to stitch the line together.
*   **`geometry.type`**: Must be `"LineString"`.
*   **`properties` parameters**:
    *   `id` or `@id` or `osmid` *(Optional)*: The unique ID of the line.
    *   `voltage` *(Optional)*: Integer. Defaults to 132.


## 2. CSV Schema

If you prefer spreadsheets, you can use CSV. A single CSV file can contain both Nodes and Edges by mixing the required columns. The parser uses the header row to determine what data is present.

### Required Header Columns
Your CSV **must** include an `id` column.

**To define a Node, the row must have:**
*   `id`: Unique identifier string.
*   `lat`: Decimal latitude.
*   `lon`: Decimal longitude.

**To define an Edge (Line), the row must have:**
*   `id`: Unique identifier string.
*   `source`: The `id` of the starting node.
*   `target`: The `id` of the ending node.

### Optional Header Columns
*   `type`: The type of node (`substation`, `pole`, `tower`).
*   `voltage`: Integer denoting KV level.

---

*Note: You do not need two separate CSV files. A single file can define a node on Row 1, and an edge on Row 2, simply by leaving the irrelevant columns empty for that row.*
