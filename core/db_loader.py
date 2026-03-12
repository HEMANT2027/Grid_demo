"""
Database loader module - replaces geojson_loader.py
Loads grid data from PostgreSQL database with PostGIS spatial queries.
"""

from db_connection import get_db_cursor
import json
from dotenv import load_dotenv
load_dotenv()

class GridDataLoader:
    """Load electrical grid data from PostgreSQL database."""
    
    @staticmethod
    def load_buses(region_bounds=None, min_voltage=None):
        """
        Load all bus/vertex data from the database.
        
        Args:
            region_bounds: Dict with 'min_lon', 'min_lat', 'max_lon', 'max_lat' (optional)
            min_voltage: Minimum voltage level to include (optional) - NOTE: Not used for vertices as they don't store voltage
        
        Returns: List of [id, lon, lat, voltage]
        """
        with get_db_cursor() as cur:
            where_clauses = []
            params = []
            
            if region_bounds:
                where_clauses.append("""
                    ST_Intersects(
                        the_geom,
                        ST_Transform(
                            ST_MakeEnvelope(%s, %s, %s, %s, 4326),
                            3857
                        )
                    )
                """)
                params.extend([
                    region_bounds['min_lon'],
                    region_bounds['min_lat'],
                    region_bounds['max_lon'],
                    region_bounds['max_lat']
                ])
            
            # Note: min_voltage parameter is ignored for vertices as gridkit_vertices table doesn't have a voltage column
            # Voltage filtering should be done on gridkit_links instead
            
            where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            cur.execute(f"""
                SELECT 
                    id,
                    ST_X(ST_Transform(the_geom, 4326)) as lon,
                    ST_Y(ST_Transform(the_geom, 4326)) as lat,
                    0 as voltage
                FROM gridkit_vertices
                {where_sql}
                ORDER BY id;
            """, params)
            
            buses = []
            for row in cur.fetchall():
                buses.append([
                    row['id'],
                    round(row['lon'], 5),
                    round(row['lat'], 5),
                    0.0  # Vertices don't have voltage information
                ])
            
            print(f"✓ Loaded {len(buses)} buses from database")
            return buses
    
    @staticmethod
    def load_lines(bus_ids=None, min_voltage=None):
        """
        Load all transmission line data from the database.
        
        Args:
            bus_ids: Set of bus IDs to filter lines (only lines connecting these buses)
            min_voltage: Minimum voltage level to include (optional)
        
        Returns: List of [id, source, target, voltage, name]
        """
        with get_db_cursor() as cur:
            where_clauses = ["source IS NOT NULL", "target IS NOT NULL"]
            params = []
            
            if bus_ids is not None:
                if len(bus_ids) > 0:
                    placeholders = ','.join(['%s'] * len(bus_ids))
                    where_clauses.append(f"source IN ({placeholders}) AND target IN ({placeholders})")
                    params.extend(list(bus_ids))
                    params.extend(list(bus_ids))
                else:
                    # No buses in region, return empty
                    print(f"✓ Loaded 0 transmission lines from database (no buses in region)")
                    return []
            
            if min_voltage:
                where_clauses.append("COALESCE(voltage, 0) >= %s")
                params.append(min_voltage)
            
            where_sql = "WHERE " + " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    id,
                    source,
                    target,
                    COALESCE(voltage, 0) as voltage,
                    type as name
                FROM gridkit_links
                {where_sql}
                ORDER BY id;
            """, params)
            
            lines = []
            for row in cur.fetchall():
                lines.append([
                    row['id'],
                    row['source'],
                    row['target'],
                    float(row['voltage']) if row['voltage'] else 0.0,
                    row['name'] or ''
                ])
            
            print(f"✓ Loaded {len(lines)} transmission lines from database")
            return lines
    
    @staticmethod
    def load_towers(region_bounds=None):
        """
        Load all tower locations from the database.
        
        Args:
            region_bounds: Dict with 'min_lon', 'min_lat', 'max_lon', 'max_lat' (optional)
        
        Returns: List of [lon, lat]
        """
        with get_db_cursor() as cur:
            where_clauses = ["geom IS NOT NULL"]
            params = []
            
            if region_bounds:
                where_clauses.append("""
                    ST_Intersects(
                        geom,
                        ST_Transform(
                            ST_MakeEnvelope(%s, %s, %s, %s, 4326),
                            3857
                        )
                    )
                """)
                params.extend([
                    region_bounds['min_lon'],
                    region_bounds['min_lat'],
                    region_bounds['max_lon'],
                    region_bounds['max_lat']
                ])
            
            where_sql = "WHERE " + " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    ST_X(ST_Transform(geom, 4326)) as lon,
                    ST_Y(ST_Transform(geom, 4326)) as lat
                FROM gridkit_towers
                {where_sql};
            """, params)
            
            towers = []
            for row in cur.fetchall():
                towers.append([
                    round(row['lon'], 5),
                    round(row['lat'], 5)
                ])
            
            print(f"✓ Loaded {len(towers)} towers from database")
            return towers
    
    @staticmethod
    def load_poles(region_bounds=None):
        """
        Load all pole locations from the database.
        
        Args:
            region_bounds: Dict with 'min_lon', 'min_lat', 'max_lon', 'max_lat' (optional)
        
        Returns: List of [lon, lat]
        """
        with get_db_cursor() as cur:
            where_clauses = ["type = 'pole'", "geometry IS NOT NULL"]
            params = []
            
            if region_bounds:
                where_clauses.append("""
                    ST_Intersects(
                        geometry,
                        ST_Transform(
                            ST_MakeEnvelope(%s, %s, %s, %s, 4326),
                            3857
                        )
                    )
                """)
                params.extend([
                    region_bounds['min_lon'],
                    region_bounds['min_lat'],
                    region_bounds['max_lon'],
                    region_bounds['max_lat']
                ])
            
            where_sql = "WHERE " + " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    ST_X(ST_Transform(geometry, 4326)) as lon,
                    ST_Y(ST_Transform(geometry, 4326)) as lat
                FROM grid_points
                {where_sql};
            """, params)
            
            poles = []
            for row in cur.fetchall():
                poles.append([
                    round(row['lon'], 5),
                    round(row['lat'], 5)
                ])
            
            print(f"✓ Loaded {len(poles)} poles from database")
            return poles
    
    @staticmethod
    def load_substations(region_bounds=None):
        """
        Load all substation data from the database.
        Queries multiple tables: gridkit_polygons, gridkit_nodes, grid_points, and grid_polygons.
        
        Args:
            region_bounds: Dict with 'min_lon', 'min_lat', 'max_lon', 'max_lat' (optional)
        
        Returns: List of [lon, lat, voltage, name]
        """
        with get_db_cursor() as cur:
            substations = []
            
            # Query 1: gridkit_nodes (point substations)
            # These are point geometries, so we can directly extract coordinates
            where_clauses = ["geom IS NOT NULL"]
            params = []
            
            if region_bounds:
                where_clauses.append("""
                    ST_Intersects(
                        geom,
                        ST_Transform(
                            ST_MakeEnvelope(%s, %s, %s, %s, 4326),
                            3857
                        )
                    )
                """)
                params.extend([
                    region_bounds['min_lon'],
                    region_bounds['min_lat'],
                    region_bounds['max_lon'],
                    region_bounds['max_lat']
                ])
            
            where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            cur.execute(f"""
                SELECT 
                    ST_X(ST_Transform(geom, 4326)) as lon,
                    ST_Y(ST_Transform(geom, 4326)) as lat,
                    COALESCE(voltage, 0) as voltage,
                    COALESCE(name, '') as name
                FROM gridkit_nodes
                {where_sql};
            """, params)
            
            count_nodes = 0
            for row in cur.fetchall():
                substations.append([
                    round(row['lon'], 5),
                    round(row['lat'], 5),
                    float(row['voltage']) if row['voltage'] else 0.0,
                    row['name'] if row['name'] else ''
                ])
                count_nodes += 1
                                    
            print(f"✓ Loaded {len(substations)} substations from database:")
            print(f"  - gridkit_nodes: {count_nodes}")
            return substations
    
    @staticmethod
    def find_substation_buses(substations, buses, radius_km=0.2):
        """
        Find all bus IDs within proximity of substations to use as power sources.
        Treats substations as areas rather than points.
        
        Args:
            substations: List of [lon, lat, voltage, name]
            buses: List of [id, lon, lat, voltage]
            radius_km: Radius in kilometers to consider buses near substations (default: 200m)
        
        Returns: List of bus IDs near substations (sorted by voltage, highest first)
        """
        if not substations or not buses:
            print("⚠ No substations or buses found, using fallback source")
            return []
        
        from math import sqrt
        
        # Convert km to approximate degrees (rough approximation: 1 degree ≈ 111 km)
        radius_degrees = radius_km / 111.0
        
        substation_bus_map = {}  # Maps bus_id to substation info
        
        # For each substation, find ALL buses within radius
        for sub_lon, sub_lat, sub_voltage, sub_name in substations:
            buses_in_area = []
            
            # Find all buses within radius of this substation
            for bus_id, bus_lon, bus_lat, bus_voltage in buses:
                # Calculate Euclidean distance (approximate, good enough for small distances)
                distance = sqrt((sub_lon - bus_lon)**2 + (sub_lat - bus_lat)**2)
                
                # Check if bus is within radius
                if distance <= radius_degrees:
                    buses_in_area.append({
                        'bus_id': bus_id,
                        'distance': distance,
                        'bus_voltage': bus_voltage
                    })
            
            # Add all buses in this substation's area
            for bus_info in buses_in_area:
                bus_id = bus_info['bus_id']
                # If bus is already associated with another substation, keep the higher voltage one
                if bus_id not in substation_bus_map or sub_voltage > substation_bus_map[bus_id]['voltage']:
                    substation_bus_map[bus_id] = {
                        'bus_id': bus_id,
                        'voltage': sub_voltage,
                        'name': sub_name,
                        'distance': bus_info['distance'],
                        'bus_voltage': bus_info['bus_voltage']
                    }
        
        # Convert to list and sort by substation voltage (highest first)
        substation_buses = list(substation_bus_map.values())
        substation_buses.sort(key=lambda x: x['voltage'], reverse=True)
        
        # Extract just the bus IDs
        source_bus_ids = [sb['bus_id'] for sb in substation_buses]
        
        print(f"✓ Found {len(source_bus_ids)} buses within {radius_km}km of substations as power sources")
        if source_bus_ids:
            # Show statistics
            voltage_groups = {}
            for sb in substation_buses:
                v = sb['voltage']
                voltage_groups[v] = voltage_groups.get(v, 0) + 1
            
            print(f"  Distribution by substation voltage:")
            for voltage in sorted(voltage_groups.keys(), reverse=True):
                print(f"    {voltage}kV substations: {voltage_groups[voltage]} buses")
            
            # Show top 5 sources
            print(f"  Top 5 power source buses:")
            for i, sb in enumerate(substation_buses[:5], 1):
                distance_km = sb['distance'] * 111.0
                print(f"    {i}. Bus {sb['bus_id']} - Near {sb['voltage']}kV substation '{sb['name'][:40] if sb['name'] else 'Unnamed'}' ({distance_km:.2f}km)")
        
        return source_bus_ids
    
    @staticmethod
    def find_external_grid_bus(buses=None):
        """
        Find the main power source bus (highest voltage substation).
        This is kept for backward compatibility but now returns the first substation bus.
        
        Args:
            buses: List of buses [id, lon, lat, voltage] to search within (optional)
        
        Returns: bus_id
        """
        if buses and len(buses) > 0:
            # Find highest voltage bus from provided list
            best_bus = max(buses, key=lambda b: b[3])  # b[3] is voltage
            ext_grid_bus = best_bus[0]  # b[0] is id
            print(f"✓ External grid bus identified: {ext_grid_bus} (voltage: {best_bus[3]} kV)")
            return ext_grid_bus
        
        with get_db_cursor() as cur:
            # Find the link with highest voltage and use its source vertex
            cur.execute("""
                SELECT source as id
                FROM gridkit_links
                WHERE voltage IS NOT NULL AND source IS NOT NULL
                ORDER BY voltage DESC, id ASC
                LIMIT 1;
            """)
            
            result = cur.fetchone()
            if result:
                ext_grid_bus = result['id']
                print(f"✓ External grid bus identified: {ext_grid_bus}")
                return ext_grid_bus
            else:
                print("⚠ No external grid bus found, using default: 0")
                return 0
    
    @staticmethod
    def load_all_grid_data(region_bounds=None, min_voltage=None):
        """
        Load all grid data from database with optional region and voltage filtering.
        
        Args:
            region_bounds: Dict with 'min_lon', 'min_lat', 'max_lon', 'max_lat' (optional)
            min_voltage: Minimum voltage level to include (optional)
        
        Returns: Dictionary with all grid components
        """
        print("\n" + "="*50)
        print("Loading Grid Data from PostgreSQL Database")
        if region_bounds:
            print(f"Region: {region_bounds}")
        if min_voltage:
            print(f"Min Voltage: {min_voltage} kV")
        print("="*50)
        
        buses = GridDataLoader.load_buses(region_bounds, min_voltage)
        # Get bus IDs for filtering lines
        bus_ids = set(b[0] for b in buses) if buses else set()
        lines = GridDataLoader.load_lines(bus_ids, min_voltage)
        towers = GridDataLoader.load_towers(region_bounds)
        poles = GridDataLoader.load_poles(region_bounds)
        substations = GridDataLoader.load_substations(region_bounds)
        
        # Find buses near substations to use as power sources
        substation_sources = GridDataLoader.find_substation_buses(substations, buses)
        
        grid_data = {
            'buses': buses,
            'lines': lines,
            'towers': towers,
            'poles': poles,
            'substations': substations,
            'substation_sources': substation_sources,  # Only substation sources, no fallback
            'stats': {
                'total_buses': len(buses),
                'total_lines': len(lines),
                'total_towers': len(towers),
                'total_poles': len(poles),
                'total_substations': len(substations),
                'total_sources': len(substation_sources)
            }
        }
        
        print("\n" + "="*50)
        print("Grid Data Summary:")
        print(f"  Buses: {grid_data['stats']['total_buses']:,}")
        print(f"  Lines: {grid_data['stats']['total_lines']:,}")
        print(f"  Towers: {grid_data['stats']['total_towers']:,}")
        print(f"  Poles: {grid_data['stats']['total_poles']:,}")
        print(f"  Substations: {grid_data['stats']['total_substations']:,}")
        print(f"  Power Sources (substations only): {grid_data['stats']['total_sources']:,}")
        print("="*50 + "\n")
        
        return grid_data
    
    @staticmethod
    def get_grid_statistics():
        """Get comprehensive grid statistics from database."""
        with get_db_cursor() as cur:
            stats = {}
            
            # Voltage distribution
            cur.execute("""
                SELECT 
                    voltage,
                    COUNT(*) as count
                FROM gridkit_links
                WHERE voltage IS NOT NULL
                GROUP BY voltage
                ORDER BY voltage DESC;
            """)
            stats['voltage_distribution'] = cur.fetchall()
            
            # Network connectivity
            cur.execute("""
                SELECT 
                    COUNT(DISTINCT source) as unique_sources,
                    COUNT(DISTINCT target) as unique_targets,
                    COUNT(*) as total_links
                FROM gridkit_links;
            """)
            stats['connectivity'] = cur.fetchone()
            
            # Geographic bounds
            cur.execute("""
                SELECT 
                    ST_XMin(ST_Extent(ST_Transform(the_geom, 4326))) as min_lon,
                    ST_YMin(ST_Extent(ST_Transform(the_geom, 4326))) as min_lat,
                    ST_XMax(ST_Extent(ST_Transform(the_geom, 4326))) as max_lon,
                    ST_YMax(ST_Extent(ST_Transform(the_geom, 4326))) as max_lat
                FROM gridkit_vertices;
            """)
            stats['bounds'] = cur.fetchone()
            
            return stats


if __name__ == "__main__":
    # Test loading data
    from db_connection import DatabaseConnection
    
    try:
        grid_data = GridDataLoader.load_all_grid_data()
        
        # Show sample data
        print("\nSample Data:")
        print(f"First 3 buses: {grid_data['buses'][:3]}")
        print(f"First 3 lines: {grid_data['lines'][:3]}")
        
        # Get statistics
        print("\nDetailed Statistics:")
        stats = GridDataLoader.get_grid_statistics()
        print(f"Voltage Distribution: {stats['voltage_distribution'][:5]}")
        print(f"Connectivity: {stats['connectivity']}")
        print(f"Geographic Bounds: {stats['bounds']}")
        
    finally:
        DatabaseConnection.close_all_connections()
