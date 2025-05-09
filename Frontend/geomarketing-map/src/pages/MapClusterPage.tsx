import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const clusterColors = ["#377eb8", "#4daf4a", "#ff7f00"]


// Definierte spannende Clusterkombinationen
const clusterCombos = [
  {
    key: "jur-vs-nat",
    label: "Juristische vs. Natürliche Personen Steuer",
    kpiA: "Anteil JurPers Stuer",
    kpiB: "Anteil NatPers Steuer",
    description: "Vergleicht die Steueranteile juristischer und natürlicher Personen. Ideal für Gemeinden mit viel Unternehmensstruktur.",
  },
  {
    key: "gründung-vs-jobs",
    label: "Neugründungen vs. Beschäftigte",
    kpiA: "Anzahl Neugründungen Unternehmen",
    kpiB: "Anzahl Beschäftigte",
    description: "Misst die wirtschaftliche Aktivität: Wo entstehen Firmen, wo sind Jobs?",
  },
  {
    key: "steuerfuss-vs-jus",
    label: "Steuerfuss vs. Steuerfuss jur. Personen",
    kpiA: "Steuerfuss",
    kpiB: "Steuerfuss JusPers",
    description: "Zeigt Unterschiede in der steuerlichen Belastung – relevant für Unternehmen vs. Privatpersonen.",
  },
]

export default function MapClusterPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [clusterData, setClusterData] = useState<Record<string, { cluster: number, valA: number, valB: number }>>({})
  const [year, setYear] = useState(2023)
  const [playing, setPlaying] = useState(false)
  const [activeCombo, setActiveCombo] = useState(clusterCombos[0])
  const [selectedGemeinde, setSelectedGemeinde] = useState<any>(null)
  const dataReady = geoData && Object.keys(clusterData).length > 0


  // Geo + Clusterdaten laden
  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-geojson?year=${year}`)
      .then(res => res.json())
      .then(setGeoData)
  }, [year])
  
  useEffect(() => {
    fetch(`http://localhost:4000/api/analyse/cluster-map?year=${year}&x=${encodeURIComponent(activeCombo.kpiA)}&y=${encodeURIComponent(activeCombo.kpiB)}`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, { cluster: number, valA: number, valB: number }> = {}
        data.forEach((d: any) => {
          const bfs = String(d.BFS)
          map[bfs] = {
            cluster: d.Cluster,
            valA: d.valA,
            valB: d.valB
          }
        })
        setClusterData(map)
      })
  }, [year, activeCombo])

  useEffect(() => {
    setSelectedGemeinde(null)
  }, [activeCombo, year])

  // Automatische Animation
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
    const entry = clusterData[bfs]
    const c = entry?.cluster
    return clusterColors[c] ?? "#ccc"
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Clusterkarte</h1>
      
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <label>Jahr:</label>
        <input
          type="range"
          min={2011}
          max={2023}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="w-48"
        />
        <span className="text-blue-700 font-semibold">{year}</span>
  
        <button
          onClick={() => setPlaying(p => !p)}
          className="px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          {playing ? "⏹️" : "▶️"}
        </button>
      </div>
    
      {/* Karte mit absolut platzierter Info-Box */}
      <div style={{ height: 'calc(100vh - 140px)', width: '100%', position: "relative" }}>
        {/* Info-Box links oben */}
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
            <div className="text-base mb-2" style={{ fontWeight: 800 }}>
              {activeCombo.label}
            </div>
            <p className="text-gray-600 mb-3">{activeCombo.description}</p>
  
            <label className="block text-sm font-medium mb-1 text-gray-700">Kombi-Auswahl:</label>
            <select
              value={activeCombo.key}
              onChange={(e) =>
                setActiveCombo(clusterCombos.find(c => c.key === e.target.value)!)
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {clusterCombos.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            {selectedGemeinde && (
              <>
                <h2 className="font-bold text-blue-800 mb-2">
                  {selectedGemeinde.name}
                </h2>
                <p><strong>Cluster:</strong> {selectedGemeinde.cluster}</p>
                <p><strong>{activeCombo.kpiA}:</strong> {selectedGemeinde.valA?.toFixed(2)}</p>
                <p><strong>{activeCombo.kpiB}:</strong> {selectedGemeinde.valB?.toFixed(2)}</p>
              </>
            )}
          </div>
        </div>
  
        {/* Leaflet Map */}
        <MapContainer center={[47.4, 8.5]} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {dataReady && (
            <GeoJSON
            key={`${year}-${activeCombo.key}-${selectedGemeinde?.bfs ?? 'none'}`}
              data={geoData}
              style={(feature: any) => ({
                fillColor: getColor(feature.properties.BFS),
                fillOpacity: 0.75,
                color: "#333",
                weight: 1,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties
                const bfs = String(props.BFS)
                layer.on("click", () => {
                  const data = clusterData[bfs]
                  if (data) {
                    setSelectedGemeinde({
                      name: props.GEBIET_NAME,
                      bfs,
                      ...data
                    })
                  } else {
                    console.warn("Daten für Gemeinde nicht geladen:", bfs)
                  }
                })
              }}                      
            />
          )}
        </MapContainer>
      </div>
    </div>
  )  
}
