"""
Flask API server for serving grid data from PostgreSQL database.
This replaces the need for JSON export files - frontend fetches data directly from the database.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from db_loader import GridDataLoader
from db_connection import DatabaseConnection

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Configuration
API_HOST = os.getenv('API_HOST', 'localhost')
API_PORT = int(os.getenv('API_PORT', '5000'))


@app.route('/api/grid-data', methods=['GET'])
def get_grid_data():
    """
    Get all grid data (buses, lines, towers, poles, substations).
    Supports optional filtering by voltage and region.
    
    Query parameters:
    - min_lon, min_lat, max_lon, max_lat: Region bounds
    - min_voltage: Minimum voltage level
    - region: Predefined region ('delhi' for Delhi NCR)
    """
    try:
        print("\n" + "="*60)
        print("Received request for grid data")
        print("="*60)
        
        # Get query parameters
        min_voltage = request.args.get('min_voltage', type=int)
        region_bounds = None
        
        # Check for predefined regions
        region_name = request.args.get('region', '').lower()
        if region_name == 'delhi':
            # Delhi NCR bounding box
            region_bounds = {
                'min_lon': 76.5,
                'min_lat': 28.4,
                'max_lon': 77.8,
                'max_lat': 28.9
            }
            print(f"Using predefined region: Delhi NCR")
        elif request.args.get('min_lon'):
            region_bounds = {
                'min_lon': request.args.get('min_lon', type=float),
                'min_lat': request.args.get('min_lat', type=float),
                'max_lon': request.args.get('max_lon', type=float),
                'max_lat': request.args.get('max_lat', type=float)
            }
            print(f"Using custom region bounds: {region_bounds}")
        else:
            print("Loading ALL India grid data (no region filter)")
        
        if min_voltage:
            print(f"Filtering by minimum voltage: {min_voltage} kV")
        
        # Load data from database with filters
        print("Calling GridDataLoader.load_all_grid_data()...")
        grid_data = GridDataLoader.load_all_grid_data(region_bounds=region_bounds, min_voltage=min_voltage)
        
        print(f"✓ Data loaded successfully!")
        print(f"  Buses: {len(grid_data['buses']):,}")
        print(f"  Lines: {len(grid_data['lines']):,}")
        print(f"  Towers: {len(grid_data['towers']):,}")
        print(f"  Poles: {len(grid_data['poles']):,}")
        print(f"  Substations: {len(grid_data['substations']):,}")
        print("="*60 + "\n")
        
        return jsonify(grid_data), 200
        
    except Exception as e:
        print(f"✗ ERROR loading grid data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/buses', methods=['GET'])
def get_buses():
    """Get all buses/vertices."""
    try:
        buses = GridDataLoader.load_buses()
        return jsonify({'buses': buses}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/lines', methods=['GET'])
def get_lines():
    """Get all transmission lines."""
    try:
        lines = GridDataLoader.load_lines()
        return jsonify({'lines': lines}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/towers', methods=['GET'])
def get_towers():
    """Get all towers."""
    try:
        towers = GridDataLoader.load_towers()
        return jsonify({'towers': towers}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/poles', methods=['GET'])
def get_poles():
    """Get all poles."""
    try:
        poles = GridDataLoader.load_poles()
        return jsonify({'poles': poles}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/substations', methods=['GET'])
def get_substations():
    """Get all substations."""
    try:
        substations = GridDataLoader.load_substations()
        return jsonify({'substations': substations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/grid-data/statistics', methods=['GET'])
def get_statistics():
    """Get grid statistics."""
    try:
        stats = GridDataLoader.get_grid_statistics()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    try:
        # Simple database connection test
        from db_connection import get_db_cursor
        with get_db_cursor() as cur:
            cur.execute("SELECT 1;")
            return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'database': 'disconnected', 'error': str(e)}), 503


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    print(f"\n{'='*60}")
    print("Starting Grid Data API Server")
    print(f"{'='*60}")
    print(f"API URL: http://{API_HOST}:{API_PORT}")
    print(f"Endpoints:")
    print(f"  GET /api/grid-data          - Get all grid data")
    print(f"  GET /api/grid-data/buses     - Get buses only")
    print(f"  GET /api/grid-data/lines     - Get lines only")
    print(f"  GET /api/grid-data/towers    - Get towers only")
    print(f"  GET /api/grid-data/poles     - Get poles only")
    print(f"  GET /api/grid-data/substations - Get substations only")
    print(f"  GET /api/grid-data/statistics - Get statistics")
    print(f"  GET /api/health              - Health check")
    print(f"{'='*60}\n")
    
    # Run with debug mode but disable reloader to prevent .venv file watching issues
    app.run(host=API_HOST, port=API_PORT, debug=True, use_reloader=False)

