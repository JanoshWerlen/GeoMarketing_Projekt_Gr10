import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"
import "leaflet/dist/leaflet.css"

export default function MapDeviationPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [deviationMap, setDeviationMap] = useState<Record<string, number>>({})
  const [year, setYear] = useState(2023)
  const [kpiA, setKpiA] = useState("Anzahl Neugründungen Unternehmen")
  const [kpiB, setKpiB] = useState("Steuerkraft in Mio")
  const [playing, setPlaying] = useState(false)
  const [selectedGemeinde, setSelectedGemeinde] = useState<any>(null)

  // Fetch data
  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-geojson?year=${year}`)
      .then(res => res.json())
      .then(setGeoData)

    fetch(`http://localhost:4000/api/analyse/kpi-deviation-map?year=${year}&x=${kpiA}&y=${kpiB}`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, number> = {}
        data.forEach((d: any) => {
          map[d.BFS] = d.deviation
        })
        setDeviationMap(map)
      })
  }, [year, kpiA, kpiB])

  // Reset selection when KPI/year changes
  useEffect(() => {
    setSelectedGemeinde(null)
  }, [year, kpiA, kpiB])

  // Play effect
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

  const getColor = (bfs: string) => {
    const dev = deviationMap[bfs]
    if (dev == null) return "#ccc"
  
    const maxDev = 200 // max expected deviation (adjust as needed)
    const norm = Math.min(Math.abs(dev) / maxDev, 1) // normalized 0–1
    const strength = Math.round(255 * (1 - norm ** 0.5)) // nonlinear scale for more contrast
  
    return dev > 0
      ? `rgb(255, ${strength}, ${strength})`  // red: higher dev = darker
      : `rgb(${strength}, ${strength}, 255)`  // blue: higher neg dev = darker
  }
  

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Abweichung von KPI-Zusammenhang</h1>
      
      <div className="flex gap-4 mb-4 items-center">
        <label>KPI X:
          <select className="ml-2" value={kpiA} onChange={(e) => setKpiA(e.target.value)}>
            <option>Anzahl Neugründungen Unternehmen</option>
            <option>Bauinvestition in Mio</option>
            <option>Steuerkraft pro Kopf</option>
          </select>
        </label>
        <label>KPI Y:
          <select className="ml-2" value={kpiB} onChange={(e) => setKpiB(e.target.value)}>
            <option>Steuerkraft in Mio</option>
            <option>Steuerkraft pro Kopf</option>
            <option>Sozialhilfequote</option>
          </select>
        </label>
        <label>Jahr:
          <input
            type="range"
            min={2011}
            max={2023}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="ml-2 w-48"
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

      <div style={{ height: 'calc(100vh - 140px)', width: '100%', position: "relative" }}>
        
        {/* Info-Box bei Auswahl */}
        {selectedGemeinde && (
          <div
            style={{
              position: "absolute",
              top: "1rem",
              left: "1rem",
              zIndex: 1000,
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              padding: "1rem",
              width: "320px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div className="text-sm text-gray-700">
              <h2 className="font-bold text-blue-800 mb-2">
                {selectedGemeinde.name}
              </h2>
              <p><strong>Abweichung:</strong> {selectedGemeinde.deviation?.toFixed(1) ?? "-"}</p>
              <p className="mt-2 text-gray-600"><em>Zwischen KPI X und KPI Y</em></p>
              <p><strong>X:</strong> {kpiA}</p>
              <p><strong>Y:</strong> {kpiB}</p>
            </div>
          </div>
        )}

        {/* Farblegende oben rechts */}
        <DeviationLegend />

        <MapContainer center={[47.4, 8.5]} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
            key={`${kpiA}-${kpiB}-${year}-${Object.keys(deviationMap).length}`}
              data={geoData}
              style={(feature: any) => ({
                fillColor: getColor(feature.properties.BFS),
                fillOpacity: 0.75,
                color: "#333",
                weight: 1,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties
                const bfs = String(parseInt(props.BFS))  // normalize
                layer.on("click", () => {
                  setSelectedGemeinde({
                    name: props.GEBIET_NAME,
                    bfs,
                    deviation: deviationMap[bfs]
                  })
                })
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}

// Farblegende oben rechts
function DeviationLegend() {
  const steps = [
    { color: "rgb(255,60,60)", label: "stark positiv" },
    { color: "rgb(255,150,150)", label: "moderat positiv" },
    { color: "rgb(255,230,230)", label: "leicht positiv" },
    { color: "rgb(200,215,255)", label: "leicht negativ" },
    { color: "rgb(180,200,255)", label: "moderat negativ" },
    { color: "rgb(130,150,255)", label: "stark negativ" },
  ]

  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 1000,
        backgroundColor: "#fff",
        borderRadius: "0.75rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: "1rem",
        width: "260px",
        border: "1px solid #e5e7eb",
        fontSize: "0.875rem",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "0.75rem", color: "#1f2937" }}>
        Abweichungsskala
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "28px",
                height: "16px",
                backgroundColor: step.color,
                border: "1px solid #ccc",
                borderRadius: "2px",
                marginRight: "10px",
              }}
            />
            <span style={{ color: "#374151", fontSize: "0.85rem" }}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

