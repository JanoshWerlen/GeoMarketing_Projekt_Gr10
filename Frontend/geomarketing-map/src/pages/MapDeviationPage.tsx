import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"

export default function MapDeviationPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [deviationMap, setDeviationMap] = useState<Record<string, number>>({})
  const [year, setYear] = useState("2023")
  const [kpiA, setKpiA] = useState("Anzahl Neugründungen Unternehmen")
  const [kpiB, setKpiB] = useState("Steuerkraft in Mio")

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

  const getColor = (bfs: string) => {
    const dev = deviationMap[bfs]
    if (dev == null) return "#ccc"
    const clamped = Math.max(-1000, Math.min(1000, dev))
    const scale = 255 - Math.min(255, Math.abs(clamped) * 5)
    return dev > 0
      ? `rgb(255, ${scale}, ${scale})`  // rot
      : `rgb(${scale}, ${scale}, 255)`  // blau
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Abweichung von KPI-Zusammenhang</h1>
      <div className="flex gap-4 mb-2">
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
        <label className="ml-6">Year: <span className="font-semibold text-blue-700">{year}</span></label>
          <input
            type="range"
            min={2011}
            max={2023}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-32"
          />
      </div>
      <div style={{ height: 'calc(100vh - 120px)', width: '100%' }}>          
      <MapContainer center={[47.4, 8.5]} zoom={10} style={{ height: "100%", width: "100%"}} scrollWheelZoom={true}>
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
              data={geoData}
              style={(feature: any) => ({
                fillColor: getColor(feature.properties.BFS),
                fillOpacity: 0.75,
                color: "#333",
                weight: 1,
              })}
              onEachFeature={(feature, layer) => {
                const props = feature.properties
                const dev = deviationMap[props.BFS]
                layer.bindTooltip(`${props.GEBIET_NAME}<br/>Abweichung: ${dev?.toFixed(1) ?? "?"}`, { sticky: true })
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
