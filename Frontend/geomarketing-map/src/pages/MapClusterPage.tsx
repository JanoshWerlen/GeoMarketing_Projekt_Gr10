import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const clusterColors = ["#377eb8", "#4daf4a", "#ff7f00"]

export default function MapClusterPage() {
  const [geoData, setGeoData] = useState<any>(null)
  const [clusterData, setClusterData] = useState<Record<string, number>>({})
  const [year, setYear] = useState("2023")

  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-geojson?year=${year}`)
      .then(res => res.json())
      .then(setGeoData)

    fetch(`http://localhost:4000/api/analyse/cluster-map?year=${year}`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, number> = {}
        data.forEach((d: any) => {
          map[d.BFS] = d.Cluster
        })
        setClusterData(map)
      })
  }, [year])

  const getColor = (bfs: string) => {
    const c = clusterData[bfs]
    return clusterColors[c] ?? "#ccc"
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Clusterkarte</h1>
      <label className="ml-6">Year: <span className="font-semibold text-blue-700">{year}</span></label>
          <input
            type="range"
            min={2011}
            max={2023}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-32"
          />
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
                const cluster = clusterData[props.BFS]
                layer.bindTooltip(`${props.GEBIET_NAME}<br/>Cluster: ${cluster}`, { sticky: true })
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
