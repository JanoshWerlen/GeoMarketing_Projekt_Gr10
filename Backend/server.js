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

// Utility: Convert numeric-looking strings to numbers in an object
function convertNumericStrings(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertNumericStrings);
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && value.trim() !== "" && !isNaN(value)) {
        out[key] = Number(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return obj;
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

// ==========================
// 🚦 Health & Utility Routes
// ==========================

// Simple test route
app.get("/", (req, res) => {
  res.send("✅ Backend is running")
})

// ==========================
// 📊 KPI & Moran Score APIs
// ==========================

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
    res.json(convertNumericStrings(result.rows));
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================
// 🏘️ Gemeinde Details & Timeseries APIs
// ==========================

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

    // Drop the same fields as /api/gemeinden-kpis
    const dropFields = ["geom", "geometry", "ARPS", "ART_CODE", "SHAPE_AREA", "SHAPE_LEN", "BFS_NR"]
    const filtered = { ...row }
    dropFields.forEach(field => {
      delete filtered[field]
    })

    // Ensure Moran_I exists as float or null (optional, for consistency)
    if (!('Moran_I' in filtered)) filtered.Moran_I = null

    res.json(convertNumericStrings(filtered))
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

    res.json(convertNumericStrings(result.rows))
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal error" })
  }
})

// ==========================
// 🗂️ Gemeinde KPIs APIs
// ==========================

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
      return res.json(convertNumericStrings(filtered));
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ⬅️ Case 2: Cached year-specific data
  if (!year || !cache.kpis[year]) {
    return res.status(400).json({ error: "Invalid or missing year" });
  }

  // Convert numeric-looking strings to numbers for each row
  const enriched = cache.kpis[year].map(row => {
    const r = { ...row, Moran_I: row.Moran_I ?? null };
    return r;
  });

  res.json(convertNumericStrings(enriched));
});

const Cursor = require("pg-cursor");

// Stream all Gemeinde KPIs for all years (large data)
app.get("/api/gemeinden-kpis-all", async (req, res) => {
  try {
    const client = await pool.connect();
    const query = `SELECT * FROM public.gemeinden_merged WHERE "Year" BETWEEN 1990 AND 2024`;
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
          res.write(JSON.stringify(convertNumericStrings(row)));
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
    res.json(convertNumericStrings(result.rows))
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ==========================
// 🗺️ GeoJSON & Spatial APIs
// ==========================

// Serve preloaded GeoJSON data
app.get("/api/gemeinden-geojson", (req, res) => {
  const { year } = req.query
  if (!year || !cache.geojson[year]) {
    return res.status(400).json({ error: "Invalid or missing year" })
  }
  res.json(convertNumericStrings(cache.geojson[year]))
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

    res.json(convertNumericStrings(adjacency))
  } catch (err) {
    console.error("DB error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Korrelationsanalyse
app.get("/api/analyse/korrelationen", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM public.gemeinden_merged WHERE "Year" BETWEEN 2011 AND 2023
    `)

    const data = result.rows
    const numericKeys = Object.keys(data[0]).filter(
      k => typeof data[0][k] === "number" || (!isNaN(data[0][k]) && data[0][k] !== null)
    ).filter(k => !["BFS", "Year"].includes(k))

    const correlations = []

    for (let i = 0; i < numericKeys.length; i++) {
      for (let j = i + 1; j < numericKeys.length; j++) {
        const a = numericKeys[i]
        const b = numericKeys[j]
        const x = []
        const y = []
        for (const row of data) {
          const va = parseFloat(row[a])
          const vb = parseFloat(row[b])
          if (!isNaN(va) && !isNaN(vb)) {
            x.push(va)
            y.push(vb)
          }
        }
        if (x.length < 5) continue
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length
        const meanX = mean(x), meanY = mean(y)
        const cov = x.reduce((sum, xi, idx) => sum + (xi - meanX) * (y[idx] - meanY), 0)
        const stdX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0))
        const stdY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0))
        const r = cov / (stdX * stdY)
        correlations.push({ pair: `${a} vs ${b}`, r })
      }
    }

    res.json(correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)))
  } catch (err) {
    console.error("Korrelation error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Cluster Analyse
app.get("/api/analyse/cluster", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "GEBIET_NAME", "Steuerkraft pro Kopf", "Bauinvestition in Mio", "Anzahl Neugründungen Unternehmen"
      FROM public.gemeinden_merged
      WHERE "Year" = 2023
    `)

    // Konvertiere Werte zu Zahlen & filtere unvollständige
    const data = result.rows
      .map(r => ({
        name: r["GEBIET_NAME"],
        steuerkraft: Number(r["Steuerkraft pro Kopf"]),
        bau: Number(r["Bauinvestition in Mio"]),
        neu: Number(r["Anzahl Neugründungen Unternehmen"]),
      }))
      .filter(r =>
        !isNaN(r.steuerkraft) &&
        !isNaN(r.bau) &&
        !isNaN(r.neu)
      )

    if (data.length < 3) return res.json([])

    // K-Means Light (3 Cluster, 5 Iterationen)
    const vectors = data.map(d => [d.steuerkraft, d.bau, d.neu])
    let centroids = vectors.slice(0, 3)
    let assignments = []

    for (let iter = 0; iter < 5; iter++) {
      assignments = vectors.map(v => {
        const distances = centroids.map(c =>
          Math.sqrt(c.reduce((sum, val, i) => sum + (val - v[i]) ** 2, 0))
        )
        return distances.indexOf(Math.min(...distances))
      })
      for (let i = 0; i < 3; i++) {
        const members = vectors.filter((_, idx) => assignments[idx] === i)
        if (members.length > 0) {
          centroids[i] = members[0].map((_, dim) =>
            members.reduce((sum, v) => sum + v[dim], 0) / members.length
          )
        }
      }
    }

    const clustered = data.map((d, i) => ({
      GEBIET_NAME: d.name,
      "Steuerkraft pro Kopf": d.steuerkraft,
      "Bauinvestition in Mio": d.bau,
      "Anzahl Neugründungen Unternehmen": d.neu,
      Cluster: assignments[i],
    }))

    res.json(clustered)
  } catch (err) {
    console.error("❌ Cluster error:", err)
    res.status(500).json({ error: "Cluster error" })
  }
})

// Cluster-Mapping-API
app.get("/api/analyse/cluster-map", async (req, res) => {
  const year = parseInt(req.query.year)
  if (!year) return res.status(400).json({ error: "Missing year" })

  try {
    const result = await pool.query(
      `SELECT "BFS", "GEBIET_NAME", "Steuerkraft pro Kopf", "Bauinvestition in Mio", "Anzahl Neugründungen Unternehmen"
       FROM public.gemeinden_merged WHERE "Year" = $1`, [year]
    )

    const data = result.rows.filter(r =>
      !isNaN(Number(r["Steuerkraft pro Kopf"])) &&
      !isNaN(Number(r["Bauinvestition in Mio"])) &&
      !isNaN(Number(r["Anzahl Neugründungen Unternehmen"]))
    )

    const vectors = data.map(d => [
      Number(d["Steuerkraft pro Kopf"]),
      Number(d["Bauinvestition in Mio"]),
      Number(d["Anzahl Neugründungen Unternehmen"])
    ])

    const k = 3
    let centroids = vectors.slice(0, k)
    let assignments = []

    for (let iter = 0; iter < 5; iter++) {
      assignments = vectors.map(v => {
        const distances = centroids.map(c =>
          Math.sqrt(c.reduce((sum, val, i) => sum + (val - v[i]) ** 2, 0))
        )
        return distances.indexOf(Math.min(...distances))
      })
      for (let i = 0; i < k; i++) {
        const members = vectors.filter((_, idx) => assignments[idx] === i)
        if (members.length > 0) {
          centroids[i] = members[0].map((_, dim) =>
            members.reduce((sum, v) => sum + v[dim], 0) / members.length
          )
        }
      }
    }

    const mapped = data.map((row, i) => ({
      BFS: row.BFS,
      Cluster: assignments[i]
    }))

    res.json(mapped)
  } catch (err) {
    console.error("Cluster map error:", err)
    res.status(500).json({ error: "Internal error" })
  }
})

// KPI-Deviation-Map
app.get("/api/analyse/kpi-deviation-map", async (req, res) => {
  const { year, x, y } = req.query
  if (!year || !x || !y) return res.status(400).json({ error: "Missing parameters" })

  try {
    const result = await pool.query(
      `SELECT "BFS", "${x}", "${y}" FROM public.gemeinden_merged WHERE "Year" = $1`,
      [year]
    )

    const data = result.rows.map(r => ({
      BFS: r.BFS,
      x: Number(r[x]),
      y: Number(r[y])
    })).filter(r => !isNaN(r.x) && !isNaN(r.y))

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    const meanX = mean(data.map(d => d.x))
    const meanY = mean(data.map(d => d.y))
    const stdX = Math.sqrt(data.reduce((sum, d) => sum + (d.x - meanX) ** 2, 0))
    const cov = data.reduce((sum, d) => sum + (d.x - meanX) * (d.y - meanY), 0)
    const slope = cov / (stdX ** 2)
    const intercept = meanY - slope * meanX

    const resultData = data.map(d => {
      const expectedY = slope * d.x + intercept
      return {
        BFS: d.BFS,
        deviation: d.y - expectedY
      }
    })

    res.json(resultData)
  } catch (err) {
    console.error("Deviation map error:", err)
    res.status(500).json({ error: "Internal error" })
  }
})

// Ausreisser
app.get("/api/analyse/outliers", async (req, res) => {
  try {
    const clusterResult = await pool.query(`
      SELECT "GEBIET_NAME", "Steuerkraft pro Kopf", "Bauinvestition in Mio", "Anzahl Neugründungen Unternehmen"
      FROM public.gemeinden_merged
      WHERE "Year" = 2023
    `)

    const data = clusterResult.rows
      .map(r => ({
        name: r["GEBIET_NAME"],
        steuerkraft: Number(r["Steuerkraft pro Kopf"]),
        bau: Number(r["Bauinvestition in Mio"]),
        neu: Number(r["Anzahl Neugründungen Unternehmen"])
      }))
      .filter(r =>
        !isNaN(r.steuerkraft) &&
        !isNaN(r.bau) &&
        !isNaN(r.neu)
      )

    if (data.length < 3) return res.json([])

    const vectors = data.map(d => [d.steuerkraft, d.bau, d.neu])
    let centroids = vectors.slice(0, 3)
    let assignments = []

    for (let iter = 0; iter < 5; iter++) {
      assignments = vectors.map(v => {
        const distances = centroids.map(c =>
          Math.sqrt(c.reduce((sum, val, i) => sum + (val - v[i]) ** 2, 0))
        )
        return distances.indexOf(Math.min(...distances))
      })
      for (let i = 0; i < 3; i++) {
        const members = vectors.filter((_, idx) => assignments[idx] === i)
        if (members.length > 0) {
          centroids[i] = members[0].map((_, dim) =>
            members.reduce((sum, v) => sum + v[dim], 0) / members.length
          )
        }
      }
    }

    const withCluster = data.map((d, i) => ({
      GEBIET_NAME: d.name,
      "Steuerkraft pro Kopf": d.steuerkraft,
      "Anzahl Neugründungen Unternehmen": d.neu,
      Cluster: assignments[i]
    }))

    // Sortiere nach Steuerkraft absteigend
    const sorted = withCluster.sort((a, b) => b["Steuerkraft pro Kopf"] - a["Steuerkraft pro Kopf"])

    const top = sorted.slice(0, 10)
    const bottom = sorted.slice(-10)

    res.json([...top, ...bottom])
  } catch (err) {
    console.error("❌ Outlier error:", err)
    res.status(500).json({ error: "Outlier error" })
  }
})


// ==========================
// 🚀 Server Startup
// ==========================

// Start server and preload data
app.listen(PORT, async () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  await preloadData()
})
