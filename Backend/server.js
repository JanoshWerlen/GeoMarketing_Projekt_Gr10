// server.js
const express = require("express")
const cors = require("cors")
const { Pool } = require("pg")
require("dotenv").config()

const app = express()
const PORT = 4000 // you can change this

app.use(cors())
app.use(express.json())

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.LOCAL_DB_URL
})

// Cache for preloaded data
const cache = {
  geojson: {}, // { year: geojsonData }
  kpis: {},    // { year: kpiData }
}

// Preload data for all years
const preloadData = async () => {
  const years = Array.from({ length: 2024 - 2011 + 1 }, (_, i) => 2011 + i) // 1990 to 2023
  console.log("⏳ Preloading data for all years...")

  for (const year of years) {
    try {
      // Preload GeoJSON data
      const geojsonResult = await pool.query(
        `SELECT 
          "BFS", "GEBIET_NAME", "Year",
          (SELECT jsonb_strip_nulls(to_jsonb(t) - 'geometry')) as properties,
          ST_AsGeoJSON(t.geometry)::json as geometry
        FROM (
          SELECT * FROM public.gemeinden_merged WHERE "Year" = $1
        ) t`,
        [year]
      )
      cache.geojson[year] = {
        type: "FeatureCollection",
        features: geojsonResult.rows.map(row => ({
          type: "Feature",
          properties: row.properties,
          geometry: row.geometry,
        })),
      }

      // Preload KPI data
      const kpiResult = await pool.query(
        `SELECT * FROM public.gemeinden_merged WHERE "Year" = $1`,
        [year]
      )
      const dropFields = ["geom", "geometry", "ARPS", "ART_CODE", "SHAPE_AREA", "SHAPE_LEN"]
      cache.kpis[year] = kpiResult.rows.map(row => {
        const filtered = { ...row }
        dropFields.forEach(f => delete filtered[f])
        return filtered
      })

      console.log(`✅ Preloaded data for year ${year}`)
    } catch (err) {
      console.error(`❌ Failed to preload data for year ${year}:`, err)
    }
  }

  console.log("✅ Preloading complete.")
}

// Simple test route
app.get("/", (req, res) => {
  res.send("✅ Backend is running")
})

app.get("/api/moran-scores", async (req, res) => {
  const { year, kpi, gemeinden } = req.query;
  if (!year || !kpi) return res.status(400).json({ error: "Missing year or KPI" });

  try {
    let result;
    if (gemeinden) {
      // Filter by BFS list
      const ids = gemeinden.split(",").map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) return res.json([]);
      // Use parameterized query for IN clause
      const params = [year, kpi, ...ids];
      const placeholders = ids.map((_, i) => `$${i + 3}`).join(",");
      result = await pool.query(
        `SELECT * FROM moran_scores WHERE "Year" = $1 AND "KPI" = $2 AND "BFS" IN (${placeholders})`,
        params
      );
    } else {
      // Return all for year and KPI
      result = await pool.query(
        `SELECT * FROM moran_scores WHERE "Year" = $1 AND "KPI" = $2`,
        [year, kpi]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Gemeinde details API
app.get("/api/gemeinde-details", async (req, res) => {
  const { bfs, year } = req.query
  if (!bfs || !year) return res.status(400).json({ error: "Missing bfs or year" })

  try {
    const result = await pool.query(
      `SELECT * FROM gemeinden_merged WHERE "BFS" = $1 AND "Year" = $2 LIMIT 1`,
      [bfs, year]
    )
    const row = result.rows[0]
    if (!row) return res.status(404).json({ error: "Not found" })

    // Fields to always include:
    const alwaysInclude = ["BFS", "BFS_NR", "GEBIET_NAME", "Year"]

    // Filter: keep numbers (KPIs) + essential meta
    const filtered = Object.fromEntries(
      Object.entries(row).filter(([key, value]) =>
        alwaysInclude.includes(key) || typeof value === "number"
      )
    )

  // Drop the following fields: ARPS, ART_CODE, SHAPE_AREA, SHAPE_LEN
  const dropFields = ["ARPS", "ART_CODE", "SHAPE_AREA", "SHAPE_LEN"]
  dropFields.forEach(field => {
    delete filtered[field]
  })

  res.json(filtered)
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/gemeinde-timeseries
app.get("/api/gemeinde-timeseries", async (req, res) => {
  const { bfs } = req.query
  if (!bfs) return res.status(400).json({ error: "Missing bfs" })

  try {
    const result = await pool.query(
      `SELECT * FROM public.gemeinden_merged WHERE "BFS" = $1 ORDER BY "Year" ASC`,
      [bfs]
    )

    res.json(result.rows)
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal error" })
  }
})

app.get("/api/gemeinden-kpis", async (req, res) => {
  const { year, allYears, gemeinde } = req.query;

  // ⬅️ Case 1: All years for a specific Gemeinde
  if (allYears && gemeinde) {
    try {
      const result = await pool.query(
        `SELECT * FROM public.gemeinden_merged WHERE "GEBIET_NAME" = $1 ORDER BY "Year" ASC`,
        [gemeinde]
      );
      const dropFields = ["geom", "geometry", "ARPS", "ART_CODE", "SHAPE_AREA", "SHAPE_LEN"];
      const filtered = result.rows.map(row => {
        const r = { ...row };
        dropFields.forEach(f => delete r[f]);
        // Ensure `Moran_I` exists as a float (or null)
        if (!('Moran_I' in r)) r.Moran_I = null;
        return r;
      });
      return res.json(filtered);
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ⬅️ Case 2: Cached year-specific data
  if (!year || !cache.kpis[year]) {
    return res.status(400).json({ error: "Invalid or missing year" });
  }

  // ✅ Add Moran_I to cached data if missing
  const enriched = cache.kpis[year].map(row => ({
    ...row,
    Moran_I: row.Moran_I ?? null,
  }));

  res.json(enriched);
});


const Cursor = require("pg-cursor");

app.get("/api/gemeinden-kpis-all", async (req, res) => {
  try {
    const client = await pool.connect();
    const query = `SELECT * FROM public.gemeinden_merged WHERE "Year" BETWEEN 1990 AND 2022`;
    const cursor = client.query(new Cursor(query));

    res.setHeader("Content-Type", "application/json");
    res.write("[");
    let first = true;

    const readNext = () => {
      cursor.read(500, (err, rows) => {
        if (err) {
          console.error("Cursor read error:", err);
          cursor.close(() => client.release());
          res.end("]");
          return;
        }
        if (!rows.length) {
          cursor.close(() => client.release());
          return res.end("]");
        }

        for (const row of rows) {
          if (!first) res.write(",");
          res.write(JSON.stringify(row));
          first = false;
        }

        setImmediate(readNext); // continue asynchronously
      });
    };

    readNext();
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/gemeinden-kpi-averages
app.get("/api/gemeinden-kpi-averages", async (req, res) => {
  try {
    const { x, y } = req.query
    if (!x || !y) return res.status(400).json({ error: "Missing KPI parameters" })

    const query = `
      SELECT "Year",
        AVG(CASE WHEN "${x}" IS NOT NULL THEN "${x}" ELSE NULL END)::float AS x_avg,
        AVG(CASE WHEN "${y}" IS NOT NULL THEN "${y}" ELSE NULL END)::float AS y_avg
      FROM public.gemeinden_merged
      GROUP BY "Year"
      ORDER BY "Year"
    `

    const result = await pool.query(query)
    res.json(result.rows)
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Serve preloaded GeoJSON data
app.get("/api/gemeinden-geojson", (req, res) => {
  const { year } = req.query
  if (!year || !cache.geojson[year]) {
    return res.status(400).json({ error: "Invalid or missing year" })
  }
  res.json(cache.geojson[year])
})

// GET /api/gemeinde-adjacency
app.get("/api/gemeinde-adjacency", async (req, res) => {
  try {
    // Query all Gemeinde geometries for the latest year (adjust as needed)
    const year = 2023
    const result = await pool.query(
      `SELECT "BFS", geometry FROM public.gemeinden_merged WHERE "Year" = $1`,
      [year]
    )
    const gemeinden = result.rows

    // Build adjacency map: { BFS: [adjacent_BFS, ...], ... }
    const adjacency = {}

    // For each Gemeinde, find touching neighbors
    for (const g of gemeinden) {
      const neighborsResult = await pool.query(
        `SELECT "BFS" FROM public.gemeinden_merged 
         WHERE "Year" = $1 AND "BFS" != $2 
         AND ST_Touches($3::geometry, geometry)`,
        [year, g.BFS, g.geometry]
      )
      adjacency[g.BFS] = neighborsResult.rows.map(r => r.BFS.toString())
    }

    res.json(adjacency)
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Start server and preload data
app.listen(PORT, async () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  await preloadData()
})
