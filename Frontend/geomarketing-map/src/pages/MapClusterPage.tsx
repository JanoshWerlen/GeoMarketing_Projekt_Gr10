import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useMap } from "react-leaflet"
import L from "leaflet"

const clusterColors = ["#377eb8", "#4daf4a", "#ff7f00"]



// Definierte spannende Clusterkombinationen
const clusterCombos = [
  {
    key: "steuerkraft-vs-beschaeftigte",
    label: "Steuerkraft (Mio) vs. Anzahl Beschäftigte",
    kpiA: "Steuerkraft in Mio",
    kpiB: "Anzahl Beschäftigte",
    description:
      "Vergleicht das Steueraufkommen einer Gemeinde mit der Zahl der Erwerbstätigen. Erwartung: Gemeinden mit vielen Arbeitsplätzen haben mehr Steuereinnahmen. Cluster trennen typische Wohnorte von Wirtschaftsstandorten.",
  },
  {
    key: "gewinn-vs-steuerkraft",
    label: "Reingewinn jur. Personen vs. Steuerkraft (Mio)",
    kpiA: "Reingewinn JursPers in Mio",
    kpiB: "Steuerkraft in Mio",
    description:
      "Zeigt den Einfluss von Unternehmensgewinnen auf das Gesamtsteueraufkommen. Gemeinden mit hohen Unternehmensgewinnen bilden eigene Cluster – typisch für Unternehmenszentren.",
  },
  {
    key: "gründung-vs-steuerkraft",
    label: "Neugründungen vs. Steuerkraft (Mio)",
    kpiA: "Anzahl Neugründungen Unternehmen",
    kpiB: "Steuerkraft in Mio",
    description:
      "Misst, ob innovationsfreundliche Standorte (viele Neugründungen) gleichzeitig hohe Steuerkraft aufweisen. Cluster zeigen: wirtschaftsdynamische vs. stagnierende Gemeinden.",
  },
  {
    key: "bau-vs-steuerkraft",
    label: "Bauinvestitionen vs. Steuerkraft (Mio)",
    kpiA: "Bauinvestition in Mio",
    kpiB: "Steuerkraft in Mio",
    description:
      "Verbindet bauliche Entwicklung mit fiskaler Stärke. Cluster trennen boomende Wachstumsgemeinden (viel Bau, hohe Einnahmen) von eher stabilen oder rückläufigen Regionen.",
  }
]

const clusterLegends: Record<string, string[]> = {
  "steuerkraft-vs-beschaeftigte": [
    "wenig Beschäftigte & tiefe Steuerkraft",
    "durchschnittliche Wirtschaftsleistung",
    "viele Beschäftigte & hohe Steuerkraft"
  ],
  "gewinn-vs-steuerkraft": [
    "geringer Unternehmensgewinn, tiefe Steuerkraft",
    "mäßige Gewinne und Steuereinnahmen",
    "hoher Reingewinn & hohe Steuerkraft (Zentrumsgemeinden)"
  ],
  "gründung-vs-steuerkraft": [
    "wenig Neugründungen, tiefe Steuerkraft",
    "mäßige Dynamik",
    "viele Gründungen & hohe Steuerkraft (dynamisch)"
  ],
  "bau-vs-steuerkraft": [
    "wenig Bauaktivität & tiefe Steuerkraft",
    "durchschnittliche Entwicklung",
    "viel Bau & hohe Steuerkraft (Wachstum)"
  ],
}

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
    const lats = coords.map(c => c[1])
    const lngs = coords.map(c => c[0])
    return [lngs.reduce((a, b) => a + b, 0) / lngs.length, lats.reduce((a, b) => a + b, 0) / lats.length]
  }
  x /= 6 * area
  y /= 6 * area
  return [x, y]
}

export function GemeindeLabels({ geoData }: { geoData: any }) {
  const map = useMap()

  useEffect(() => {
    if (!geoData || !geoData.features) return

    const labelLayers: L.Marker[] = []

    geoData.features.forEach((feature: any) => {
      const name = feature.properties?.GEBIET_NAME
      const geometry = feature.geometry
      if (!name || !geometry) return

      let latlng: L.LatLng | null = null
      if (geometry.type === "Polygon") {
        const centroid = getPolygonCentroid(geometry.coordinates[0])
        latlng = L.latLng(centroid[1], centroid[0])
      } else if (geometry.type === "MultiPolygon") {
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

export default function MapClusterPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [clusterData, setClusterData] = useState<Record<string, { cluster: number, valA: number, valB: number }>>({})
  const [year, setYear] = useState(2023)
  const [playing, setPlaying] = useState(false)
  const [activeCombo, setActiveCombo] = useState(clusterCombos[0])
  const [selectedGemeinde, setSelectedGemeinde] = useState<any>(null)
  const dataReady = geoData && Object.keys(clusterData).length > 0
  const [showLabels, setShowLabels] = useState(true)


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
            <div className="flex flex-wrap items-center gap-4" style={{ marginTop: "1.25rem" }}>
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
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700" style={{ marginTop: "1.00rem" }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              Gemeindenamen anzeigen
            </label>
            <div className="mt-4">
              <div className="font-semibold text-sm text-gray-800 mb-2" style={{ marginTop: "1.00rem" }}>Cluster-Legende</div>
              <div className="space-y-2">
                {clusterLegends[activeCombo.key].map((desc, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-700 bg-gray-50 border-gray-200 rounded-lg px-3 py-2" style={{ marginTop: "0.50rem" }}
                  >
                    <div
                      className="mt-1 rounded-md"
                      style={{
                        width: 14,
                        height: 14,
                        minWidth: 14,
                        backgroundColor: clusterColors[i],
                        border: "1px solid #999"
                      }}
                    ></div>
                    <div>
                      <div className="font-medium text-gray-800">Cluster {i}</div>
                      <div className="text-gray-600">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {selectedGemeinde && (
              <>
                <hr className="my-2 border-gray-200" />
                <h2 className="font-bold text-blue-800 mb-2">
                  {selectedGemeinde.name}
                </h2>
                <p><strong>Cluster:</strong> {selectedGemeinde.cluster}</p>
                <p>
                  <strong>{activeCombo.kpiA}:</strong>{" "}
                  {typeof selectedGemeinde.valA === "number" && !isNaN(selectedGemeinde.valA)
                    ? selectedGemeinde.valA.toFixed(2)
                    : "—"}
                </p>
                <p>
                  <strong>{activeCombo.kpiB}:</strong>{" "}
                  {typeof selectedGemeinde.valB === "number" && !isNaN(selectedGemeinde.valB)
                    ? selectedGemeinde.valB.toFixed(2)
                    : "—"}
                </p>
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
            <>
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
                      fillOpacity: 0.75,
                    })
                  })
                }}                      
              />
            {showLabels && <GemeindeLabels geoData={geoData} />}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )  
}
