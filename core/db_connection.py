"""
Database connection module for PostgreSQL with PostGIS support.
Handles connection pooling and provides utility functions for spatial queries.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
import os
from contextlib import contextmanager
from dotenv import load_dotenv
load_dotenv()

class DatabaseConnection:
    """Singleton database connection pool manager."""
    
    _connection_pool = None
    
    @classmethod
    def initialize_pool(cls, minconn=1, maxconn=10):
        """Initialize the connection pool."""
        if cls._connection_pool is None:
            try:
                cls._connection_pool = psycopg2.pool.SimpleConnectionPool(
                    minconn,
                    maxconn,
                    host=os.getenv('DB_HOST', 'localhost'),
                    port=os.getenv('DB_PORT', '5432'),
                    database=os.getenv('DB_NAME', 'grid_db'),
                    user=os.getenv('DB_USER', 'postgres'),
                    password=os.getenv('DB_PASSWORD', 'postgres')
                )
                print("✓ Database connection pool initialized")
            except Exception as e:
                print(f"✗ Error initializing connection pool: {e}")
                raise
    
    @classmethod
    def get_connection(cls):
        """Get a connection from the pool."""
        if cls._connection_pool is None:
            cls.initialize_pool()
        return cls._connection_pool.getconn()
    
    @classmethod
    def return_connection(cls, connection):
        """Return a connection to the pool."""
        if cls._connection_pool:
            cls._connection_pool.putconn(connection)
    
    @classmethod
    def close_all_connections(cls):
        """Close all connections in the pool."""
        if cls._connection_pool:
            cls._connection_pool.closeall()
            cls._connection_pool = None
            print("✓ All database connections closed")


@contextmanager
def get_db_cursor(dict_cursor=True):
    """
    Context manager for database operations.
    
    Usage:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM table")
            results = cur.fetchall()
    """
    connection = DatabaseConnection.get_connection()
    cursor_factory = RealDictCursor if dict_cursor else None
    cursor = connection.cursor(cursor_factory=cursor_factory)
    
    try:
        yield cursor
        connection.commit()
    except Exception as e:
        connection.rollback()
        print(f"✗ Database error: {e}")
        raise
    finally:
        cursor.close()
        DatabaseConnection.return_connection(connection)


def test_connection():
    """Test database connection and PostGIS availability."""
    try:
        with get_db_cursor() as cur:
            # Test basic connection
            cur.execute("SELECT version();")
            version = cur.fetchone()
            print(f"✓ PostgreSQL version: {version['version']}")
            
            # Test PostGIS
            cur.execute("SELECT PostGIS_Version();")
            postgis_version = cur.fetchone()
            print(f"✓ PostGIS version: {postgis_version['postgis_version']}")
            
            # Test pgRouting
            cur.execute("SELECT pgr_version();")
            pgrouting_version = cur.fetchone()
            print(f"✓ pgRouting version: {pgrouting_version['pgr_version']}")
            
            return True
    except Exception as e:
        print(f"✗ Connection test failed: {e}")
        return False


if __name__ == "__main__":
    # Test the connection
    print("Testing database connection...")
    if test_connection():
        print("\n✓ All database tests passed!")
    else:
        print("\n✗ Database tests failed!")
    
    DatabaseConnection.close_all_connections()
