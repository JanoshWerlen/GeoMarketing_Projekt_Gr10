import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useMap } from "react-leaflet"
import L from "leaflet"

// KPI-Kombis analog zur Clusterkarte
const deviationCombos = [
  {
    key: "steuerkraft-vs-beschaeftigte",
    label: "Steuerkraft (Mio) vs. Anzahl Beschäftigte",
    kpiA: "Steuerkraft in Mio",
    kpiB: "Anzahl Beschäftigte",
    description:
      "Zeigt Gemeinden, deren Steuerkraft höher oder tiefer ist als es aufgrund der Beschäftigtenzahl zu erwarten wäre.",
  },
  {
    key: "gewinn-vs-steuerkraft",
    label: "Reingewinn jur. Personen vs. Steuerkraft (Mio)",
    kpiA: "Reingewinn JursPers in Mio",
    kpiB: "Steuerkraft in Mio",
    description:
      "Zeigt, ob die Steuerkraft mit den Unternehmensgewinnen übereinstimmt oder stark abweicht – Hinweis auf fiskalische Sondereffekte.",
  },
  {
    key: "gründung-vs-steuerkraft",
    label: "Neugründungen vs. Steuerkraft (Mio)",
    kpiA: "Anzahl Neugründungen Unternehmen",
    kpiB: "Steuerkraft in Mio",
    description:
      "Gemeinden mit vielen Gründungen aber tiefer Steuerkraft (oder umgekehrt) werden sichtbar – wirtschaftliches Potenzial vs. Realität.",
  },
  {
    key: "bau-vs-steuerkraft",
    label: "Bauinvestitionen vs. Steuerkraft (Mio)",
    kpiA: "Bauinvestition in Mio",
    kpiB: "Steuerkraft in Mio",
    description:
      "Vergleicht Bautätigkeit mit der Steuerkraft: Investitionen ohne fiskalen Rückfluss oder umgekehrt werden sichtbar.",
  }
]

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

export default function MapDeviationPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [deviationMap, setDeviationMap] = useState<Record<string, number>>({})
  const [year, setYear] = useState(2023)
  const [playing, setPlaying] = useState(false)
  const [selectedGemeinde, setSelectedGemeinde] = useState<any>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [activeCombo, setActiveCombo] = useState(deviationCombos[0])

  const kpiA = activeCombo.kpiA
  const kpiB = activeCombo.kpiB

  // Daten laden
  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-geojson?year=${year}`)
      .then(res => res.json())
      .then(setGeoData)

    fetch(`http://localhost:4000/api/analyse/kpi-deviation-map?year=${year}&x=${encodeURIComponent(kpiA)}&y=${encodeURIComponent(kpiB)}`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, number> = {}
        data.forEach((d: any) => {
          map[d.BFS] = d.deviation
        })
        setDeviationMap(map)
      })
  }, [year, kpiA, kpiB])

  useEffect(() => {
    setSelectedGemeinde(null)
  }, [year, activeCombo])

  // Animation
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
    const maxDev = 200
    const norm = Math.min(Math.abs(dev) / maxDev, 1)
    const strength = Math.round(255 * (1 - norm ** 0.5))
    return dev > 0
      ? `rgb(255, ${strength}, ${strength})`
      : `rgb(${strength}, ${strength}, 255)`
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Abweichungskarte</h1>
      <div style={{ height: 'calc(100vh - 140px)', width: '100%', position: "relative" }}>
        <DeviationLegend />
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
            <div className="text-base font-bold mb-2 text-blue-900">
              {activeCombo.label}
            </div>
            <p className="text-gray-600 mb-3">{activeCombo.description}</p>

            <label className="block text-sm font-medium mb-1 text-gray-700">Kombi-Auswahl:</label>
            <select
              value={activeCombo.key}
              onChange={(e) =>
                setActiveCombo(deviationCombos.find(c => c.key === e.target.value)!)
              }
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-3"
            >
              {deviationCombos.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 mb-3" style={{ marginTop: "1.25rem" }}>
              <label>Jahr:</label>
              <input
                type="range"
                min={2011}
                max={2023}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-36"
              />
              <span className="text-blue-700 font-semibold">{year}</span>
              <button
                onClick={() => setPlaying(p => !p)}
                className="px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
              >
                {playing ? "⏹️" : "▶️"}
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700" style={{ marginTop: "1.25rem" }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              Gemeindenamen anzeigen
            </label>

            {selectedGemeinde && (
              <div className="mt-4 text-sm text-gray-700">
                <hr className="my-2 border-gray-200" />
                <h2 className="font-bold text-blue-800 mb-2">{selectedGemeinde.name}</h2>
                <p><strong>Abweichung:</strong> {selectedGemeinde.deviation?.toFixed(1) ?? "-"}</p>
                <p className="mt-2 text-gray-600"><em>Zwischen {kpiA} und {kpiB}</em></p>
              </div>
            )}
          </div>
        </div>

        <MapContainer center={[47.4, 8.5]} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <>
              <GeoJSON
                key={`${activeCombo.key}-${year}-${Object.keys(deviationMap).length}`}
                data={geoData}
                style={(feature: any) => ({
                  fillColor: getColor(feature.properties.BFS),
                  fillOpacity: 0.75,
                  color: "#333",
                  weight: 1,
                })}
                onEachFeature={(feature, layer) => {
                  const props = feature.properties
                  const bfs = String(parseInt(props.BFS))
                  layer.on("click", () => {
                    setSelectedGemeinde({
                      name: props.GEBIET_NAME,
                      bfs,
                      deviation: deviationMap[bfs]
                    })
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
    <div style={{
      position: "absolute", top: "1rem", right: "1rem", zIndex: 1000,
      backgroundColor: "#fff", borderRadius: "0.75rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      padding: "1rem", width: "260px", border: "1px solid #e5e7eb", fontSize: "0.875rem"
    }}>
      <div style={{ fontWeight: 700, marginBottom: "0.75rem", color: "#1f2937" }}>
        Abweichungsskala
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: "28px", height: "16px", backgroundColor: step.color,
              border: "1px solid #ccc", borderRadius: "2px", marginRight: "10px"
            }} />
            <span style={{ color: "#374151", fontSize: "0.85rem" }}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
