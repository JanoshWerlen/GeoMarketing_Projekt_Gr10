import { useEffect, useState, useCallback, useLayoutEffect } from "react"
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Line } from "react-chartjs-2"
import L from "leaflet"
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js"

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

// Helper function to compute the centroid of a polygon (GeoJSON coordinates)
function getPolygonCentroid(coords: number[][]) {
  let area = 0, x = 0, y = 0
  for (let i = 0, len = coords.length, j = len - 1; i < len; j = i++) {
    const [x0, y0] = coords[j]
    const [x1, y1] = coords[i]
    const f = x0 * y1 - x1 * y0
    area += f
    x += (x0 + x1) * f
    y += (y0 + y1) * f
  }
  area *= 0.5
  if (area === 0) {
    // fallback: average of points
    const lats = coords.map(c => c[1])
    const lngs = coords.map(c => c[0])
    return [lngs.reduce((a, b) => a + b, 0) / lngs.length, lats.reduce((a, b) => a + b, 0) / lats.length]
  }
  x /= 6 * area
  y /= 6 * area
  return [x, y]
}

// Helper component to add labels as Leaflet DivIcons
function GemeindeLabels({ geoData }: { geoData: any }) {
  const map = useMap()

  useEffect(() => {
    if (!geoData || !geoData.features) return

    const labelLayers: L.Marker[] = []

    geoData.features.forEach((feature: any) => {
      const name = feature.properties?.GEBIET_NAME
      const geometry = feature.geometry
      if (!name || !geometry) return

      // Calculate centroid for Polygon or MultiPolygon using centroid algorithm
      let latlng: L.LatLng | null = null
      if (geometry.type === "Polygon") {
        const centroid = getPolygonCentroid(geometry.coordinates[0])
        latlng = L.latLng(centroid[1], centroid[0])
      } else if (geometry.type === "MultiPolygon") {
        // Use the largest polygon for centroid
        let maxLen = 0
        let maxCoords = geometry.coordinates[0][0]
        geometry.coordinates.forEach((poly: any) => {
          if (poly[0].length > maxLen) {
            maxLen = poly[0].length
            maxCoords = poly[0]
          }
        })
        const centroid = getPolygonCentroid(maxCoords)
        latlng = L.latLng(centroid[1], centroid[0])
      }
      if (!latlng) return

      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: "gemeinde-label",
          html: `<span style="background:rgba(255,255,255,0.8);padding:1px 4px;border-radius:4px;font-size:11px;color:#222;border:1px solid #ddd;white-space:nowrap;">${name}</span>`,
          iconSize: undefined,
        }),
        interactive: false,
        keyboard: false,
      })
      marker.addTo(map)
      labelLayers.push(marker)
    })

    return () => {
      labelLayers.forEach(marker => map.removeLayer(marker))
    }
  }, [geoData, map])

  return null
}

// Helper for legend labels
function formatNumber(val: number) {
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + " Mio"
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + "k"
  return val.toLocaleString("de-CH")
}

function KpiLegend({ thresholds, selectedKpi }: { thresholds: number[], selectedKpi: string }) {
  const colors = [
    "#ffffff", "#f7fbff", "#deebf7", "#c6dbef", "#9ecae1",
    "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"
  ]
  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 1000,
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        padding: "1rem",
        width: "260px",
        border: "1px solid #e5e7eb"
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "0.5rem", fontSize: "0.875rem", color: "#1f2937" }}>
        {selectedKpi} Skala
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {colors.map((color, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", fontSize: "0.75rem" }}>
            <span
              style={{
                width: "28px",
                height: "16px",
                backgroundColor: color,
                border: "1px solid #bbb",
                borderRadius: "2px",
                display: "inline-block",
                marginRight: "8px"
              }}
            />
            <span>
              {i === 0
                ? `< ${formatNumber(thresholds[0])}`
                : i === colors.length - 1
                ? `> ${formatNumber(thresholds[thresholds.length - 1])}`
                : `${formatNumber(thresholds[i - 1])} – ${formatNumber(thresholds[i])}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}



export default function MapPage() {
  const [year, setYear] = useState(2020)
  const [geoData, setGeoData] = useState<any>(null)
  const [gemeindenKpiData, setGemeindenKpiData] = useState<any[]>([])
  const [thresholds, setThresholds] = useState<number[]>([])
  const [selectedGemeinde, setSelectedGemeinde] = useState<any>(null)
  const [gemeindeDetails, setGemeindeDetails] = useState<any>(null)
  const [kpiList, setKpiList] = useState<string[]>([])
  const [selectedKpi, setSelectedKpi] = useState<string>("Steuerkraft pro Kopf")
  const [gemeindeTimeseries, setGemeindeTimeseries] = useState<any[] | null>(null)
  const [playing, setPlaying] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setSelectedGemeinde(null)
  }, [])

  useEffect(() => {
    if (selectedGemeinde) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedGemeinde, handleKeyDown])

  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-geojson?year=${year}`)
      .then(res => res.json())
      .then(setGeoData)
      .catch((err) => console.error("GeoJSON geometry load error:", err))
  }, [year])

  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-kpis?year=${year}`)
      .then(res => res.json())
      .then((data) => {
        setGemeindenKpiData(data)
        const first = data[0] || {}
        const allKpis = Object.keys(first).filter(
          (k) => typeof first[k] === "number" && k !== "BFS" && k !== "AREA_ROUND" // Exclude BFS and AREA_ROUND
        )
        setKpiList(allKpis)
        if (!allKpis.includes(selectedKpi)) {
          setSelectedKpi(allKpis[0] || "")
        }
        const values = data
          .map((row: any) => row[selectedKpi])
          .filter((v: any) => typeof v === "number" && !isNaN(v))
          .sort((a: number, b: number) => a - b)
        if (values.length < 2) return
        const deciles: number[] = []
        for (let i = 1; i < 10; i++) {
          const idx = Math.floor((i * values.length) / 10)
          deciles.push(values[idx])
        }
        setThresholds(deciles)
      })
      .catch((err) => console.error("KPI data load error:", err))
  }, [year, selectedKpi])

  useEffect(() => {
    if (selectedGemeinde) {
      // Fetch time series data for selected Gemeinde
      fetch(`http://localhost:4000/api/gemeinde-timeseries?bfs=${selectedGemeinde.BFS}`)
        .then(res => res.json())
        .then(setGemeindeTimeseries)
        .catch(() => setGemeindeTimeseries(null))
    } else {
      setGemeindeTimeseries(null)
    }
  }, [selectedGemeinde])

  // Automatische Jahres-Animation
  useEffect(() => {
    if (!playing) return
    const interval = setInterval(() => {
      setYear(prev => {
        if (prev >= 2023) {
          clearInterval(interval)
          setPlaying(false)
          return 2023
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [playing])


  useLayoutEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const getColor = (value: number | undefined): string => {
    if (typeof value !== "number" || isNaN(value)) return "#cccccc"
    if (thresholds.length !== 9) return "#ccc"
    return value <= thresholds[0] ? "#ffffff" :
           value <= thresholds[1] ? "#f7fbff" :
           value <= thresholds[2] ? "#deebf7" :
           value <= thresholds[3] ? "#c6dbef" :
           value <= thresholds[4] ? "#9ecae1" :
           value <= thresholds[5] ? "#6baed6" :
           value <= thresholds[6] ? "#4292c6" :
           value <= thresholds[7] ? "#2171b5" :
           value <= thresholds[8] ? "#08519c" :
                                    "#08306b"
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      <div className="p-4 bg-white shadow rounded-xl z-10 flex-shrink-0 mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <label>KPI:</label>
          <select value={selectedKpi} onChange={(e) => setSelectedKpi(e.target.value)} className="min-w-[180px]">
            {kpiList.map((k) => <option key={k}>{k}</option>)}
          </select>
          <div className="flex items-center gap-3">
            <label className="ml-6">Jahr:
              <input
                type="range"
                min={2011}
                max={2023}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="ml-2 w-40"
              />
            </label>
            <span className="text-blue-700 font-semibold">{year}</span>
            <button
              onClick={() => setPlaying(p => !p)}
              className="px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
            >
              {playing ? "⏹️" : "▶️"}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {/* KPI Legend at top right */}
        {thresholds.length === 9 && (
          <KpiLegend thresholds={thresholds} selectedKpi={selectedKpi} />
        )}
        {selectedGemeinde && (
          <div
            className="absolute top-8 left-8 text-black rounded-2xl p-8 shadow-2xl border border-gray-100 w-[420px] max-h-[80vh] overflow-y-auto z-[1000] bg-white transition-all"
            style={{
              background: "rgba(255,255,255,0.97)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
              border: "1.5px solid #e5e7eb",
              backdropFilter: "blur(2px)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 tracking-tight">
                {selectedGemeinde.GEBIET_NAME ?? "Unbekannt"}
              </h3>
              <button
                onClick={() => {
                  setSelectedGemeinde(null)
                  setGemeindeDetails(null)
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 text-2xl font-bold transition-colors shadow"
                title="Schliessen"
                style={{ lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold tracking-wide border border-blue-100">
                BFS-Nr.: {selectedGemeinde.BFS}
              </span>
              <span className="text-xs bg-gray-50 text-gray-700 px-2 py-0.5 rounded font-semibold tracking-wide border border-gray-100">
                Jahr: {year}
              </span>
            </div>
            <hr className="my-3 border-gray-200" />
            {gemeindeDetails ? (
              <div className="space-y-6">
                {/* Render a timeline chart for each KPI */}
                {Object.entries(gemeindeDetails)
                  .filter(
                    ([k, v]) =>
                      typeof v === "number" &&
                      k !== "BFS" &&
                      k !== "Year" &&
                      k !== "AREA_ROUND" // Exclude AREA_ROUND
                  )
                  .map(([k]) => (
                    gemeindeTimeseries && gemeindeTimeseries.length > 0 ? (
                      <div key={k} className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100">
                        <div className="font-semibold mb-2 text-gray-700">{k}</div>
                        <Line
                          data={{
                            labels: gemeindeTimeseries.map((row: any) => row.Year),
                            datasets: [
                              {
                                label: k,
                                data: gemeindeTimeseries.map((row: any) => row[k]),
                                borderColor: "#2171b5",
                                backgroundColor: "rgba(33,113,181,0.08)",
                                fill: true,
                                pointRadius: 2,
                                tension: 0.2,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { display: false },
                              tooltip: { enabled: true },
                              datalabels: { display: false }, // <-- disables point labels
                            },
                            scales: {
                              x: { 
                                title: { display: true, text: "Jahr" },
                                // ...if you have tick callback, keep it here...
                              },
                              y: { title: { display: true, text: k } },
                            },
                          }}
                          height={120}
                        />
                      </div>
                    ) : null
                  ))}
              </div>
            ) : (
              <div className="italic text-gray-400 text-center py-8">Lade Daten...</div>
            )}
          </div>
        )}

        <MapContainer
          center={[47.4, 8.54] as [number, number]}
          zoom={10.5}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoData && Array.isArray(geoData.features) && geoData.features.length > 0 && (
            <>
              <GeoJSON
                key={`${selectedKpi}-${year}`}
                data={geoData}
                style={(feature) => {
                  const val = feature?.properties?.[selectedKpi]
                  return {
                    color: "#333",
                    weight: 1,
                    fillOpacity: 0.7,
                    fillColor: getColor(val),
                    opacity: 1,
                    dashArray: "",
                  }
                }}
                onEachFeature={(feature, layer) => {
                  if (!feature || !feature.properties) return
                  const bfs = feature.properties.BFS

                  layer.on("click", () => {
                    setSelectedGemeinde({
                      GEBIET_NAME: feature.properties.GEBIET_NAME,
                      BFS: feature.properties.BFS,
                    })
                    setGemeindeDetails(null)
                    fetch(`http://localhost:4000/api/gemeinde-details?bfs=${bfs}&year=${year}`)
                      .then(res => res.json())
                      .then(data => setGemeindeDetails(data))
                      .catch(err => console.error("Error fetching Gemeinde details:", err))
                  })
                  layer.on("mouseover", () => {
                    (layer as L.Path).setStyle({
                      weight: 2,
                      color: "#666",
                      fillOpacity: 0.9,
                    })
                  })
                  layer.on("mouseout", () => {
                    (layer as L.Path).setStyle({
                      weight: 1,
                      color: "#333",
                      fillOpacity: 0.7,
                    })
                  })
                }}
              />
              <GemeindeLabels geoData={geoData} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
