/**
 * PMTiles Feature Extractor
 * 
 * Extracts vector features from PMTiles within a bounding box,
 * validates data integrity, and builds adjacency-list-compatible structures.
 */
import { PMTiles } from 'pmtiles';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

// ── Tile math helpers ──

function lon2tile(lon, zoom) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        Math.pow(2, zoom)
    );
}

function tileToLonLat(x, y, z) {
    const n = Math.pow(2, z);
    const lon = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return [lon, lat];
}

// ── Coordinate snapping for bus IDs ──

const SNAP_PRECISION = 4; // ~11m accuracy

function coordKey(lon, lat) {
    return `${lon.toFixed(SNAP_PRECISION)},${lat.toFixed(SNAP_PRECISION)}`;
}

/**
 * Extract features from PMTiles within a bounding box.
 * @param {Object} bounds - { north, south, east, west }
 * @param {string} url - PMTiles URL (default: '/india_grid.pmtiles')
 * @returns {Promise<{ lines, busGeo, source, stats }>}
 */
export async function extractFeaturesInBounds(bounds, url = '/india_grid.pmtiles') {
    const pm = new PMTiles(url);
    const header = await pm.getHeader();

    // Pick zoom level — use min(maxZoom, 12) to balance detail vs tile count
    const zoom = Math.min(header.maxZoom || 12, 12);

    // Convert bounds to tile coordinates
    const xMin = lon2tile(bounds.west, zoom);
    const xMax = lon2tile(bounds.east, zoom);
    const yMin = lat2tile(bounds.north, zoom); // north = smaller y
    const yMax = lat2tile(bounds.south, zoom);

    // Collect all features from relevant tiles
    const rawFeatures = [];
    let tilesLoaded = 0;
    let tilesEmpty = 0;

    for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
            try {
                const resp = await pm.getZxy(zoom, x, y);
                if (!resp || !resp.data) {
                    tilesEmpty++;
                    continue;
                }
                tilesLoaded++;

                const tile = new VectorTile(new Pbf(resp.data));
                const layer = tile.layers['grid'];
                if (!layer) continue;

                for (let i = 0; i < layer.length; i++) {
                    const feat = layer.feature(i);
                    const geojson = feat.toGeoJSON(x, y, zoom);
                    rawFeatures.push(geojson);
                }
            } catch (e) {
                // Skip corrupt/missing tiles
                tilesEmpty++;
            }
        }
    }

    // ── Filter and classify ──
    const lineFeatures = [];
    const substationFeatures = [];
    const towerFeatures = [];

    for (const f of rawFeatures) {
        const t = f.properties?.type;
        if ((t === 'Line' || t === 'Cable') && f.geometry?.type === 'LineString') {
            lineFeatures.push(f);
        } else if ((t === 'Line' || t === 'Cable') && f.geometry?.type === 'MultiLineString') {
            // Flatten MultiLineString into individual LineStrings
            for (const coords of f.geometry.coordinates) {
                lineFeatures.push({
                    ...f,
                    geometry: { type: 'LineString', coordinates: coords },
                });
            }
        } else if (t === 'Substation_Icon' || t === 'Substation_Area') {
            substationFeatures.push(f);
        } else if (t === 'Tower') {
            towerFeatures.push(f);
        }
    }

    // ── Build bus map by snapping endpoints ──
    const busMap = new Map(); // coordKey → busId
    const busGeo = new Map(); // busId → [lat, lng]
    let nextBusId = 0;

    function getOrCreateBus(lon, lat) {
        const key = coordKey(lon, lat);
        if (busMap.has(key)) return busMap.get(key);
        const id = nextBusId++;
        busMap.set(key, id);
        busGeo.set(id, [lat, lon]);
        return id;
    }

    // ── Build line array ──
    const lines = [];
    let voidCount = 0;

    for (let i = 0; i < lineFeatures.length; i++) {
        const coords = lineFeatures[i].geometry.coordinates;
        if (!coords || coords.length < 2) {
            voidCount++;
            continue;
        }

        const [lon1, lat1] = coords[0];
        const [lon2, lat2] = coords[coords.length - 1];

        // Validate coordinates
        if (!isFinite(lon1) || !isFinite(lat1) || !isFinite(lon2) || !isFinite(lat2)) {
            voidCount++;
            continue;
        }

        // Check if within bounds (filter clipped tile edge features)
        const midLon = (lon1 + lon2) / 2;
        const midLat = (lat1 + lat2) / 2;
        if (midLat < bounds.south || midLat > bounds.north ||
            midLon < bounds.west || midLon > bounds.east) {
            continue;
        }

        const fromBus = getOrCreateBus(lon1, lat1);
        const toBus = getOrCreateBus(lon2, lat2);

        if (fromBus === toBus) continue; // self-loop

        const kv = parseInt(lineFeatures[i].properties?.voltage) || 0;
        const name = lineFeatures[i].properties?.name || '';

        lines.push([i, fromBus, toBus, kv, name]);
    }

    // ── Determine source node ──
    // Prefer substation bus if any, else highest-degree node
    let source = 0;

    if (substationFeatures.length > 0) {
        for (const sf of substationFeatures) {
            let coords;
            if (sf.geometry.type === 'Point') {
                coords = sf.geometry.coordinates;
            } else if (sf.geometry.type === 'Polygon') {
                // Use centroid of first ring
                const ring = sf.geometry.coordinates[0];
                if (ring && ring.length > 0) {
                    const avgLon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
                    const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
                    coords = [avgLon, avgLat];
                }
            }
            if (coords) {
                const key = coordKey(coords[0], coords[1]);
                // Find nearest bus within tolerance
                let bestDist = Infinity;
                for (const [bKey, bId] of busMap.entries()) {
                    const [bLon, bLat] = bKey.split(',').map(Number);
                    const dist = Math.abs(bLon - coords[0]) + Math.abs(bLat - coords[1]);
                    if (dist < bestDist) {
                        bestDist = dist;
                        source = bId;
                    }
                }
                if (bestDist < 0.01) break; // close enough
            }
        }
    } else if (lines.length > 0) {
        // Highest-degree node
        const degree = new Map();
        for (const [, from, to] of lines) {
            degree.set(from, (degree.get(from) || 0) + 1);
            degree.set(to, (degree.get(to) || 0) + 1);
        }
        let maxDeg = 0;
        for (const [busId, deg] of degree) {
            if (deg > maxDeg) {
                maxDeg = deg;
                source = busId;
            }
        }
    }

    // ── Extract substation & tower positions for rendering ──
    const substations = [];
    for (const sf of substationFeatures) {
        let lat, lon;
        if (sf.geometry.type === 'Point') {
            [lon, lat] = sf.geometry.coordinates;
        } else if (sf.geometry.type === 'Polygon') {
            const ring = sf.geometry.coordinates[0];
            if (ring && ring.length > 0) {
                lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
                lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
            }
        }
        if (lat != null && lon != null &&
            lat >= bounds.south && lat <= bounds.north &&
            lon >= bounds.west && lon <= bounds.east) {
            substations.push({ lat, lon, name: sf.properties?.name || '' });
        }
    }

    const towers = [];
    for (const tf of towerFeatures) {
        if (tf.geometry.type === 'Point') {
            const [lon, lat] = tf.geometry.coordinates;
            if (lat >= bounds.south && lat <= bounds.north &&
                lon >= bounds.west && lon <= bounds.east) {
                towers.push({ lat, lon });
            }
        }
    }

    return {
        lines,
        busGeo,
        source,
        substations,
        towers,
        stats: {
            tilesLoaded,
            tilesEmpty,
            totalFeatures: rawFeatures.length,
            linesExtracted: lines.length,
            busCount: busGeo.size,
            voidCount,
            substationsFound: substationFeatures.length,
            towersFound: towerFeatures.length,
        },
    };
}
