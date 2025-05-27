import { useMap } from "react-leaflet"
import L from "leaflet"
import { useEffect } from "react"

export function DeviationLayer({
  geoData,
  deviationMap,
  setSelectedGemeinde,
  maxDeviation,
}: {
  geoData: any
  deviationMap: Record<string, number>
  setSelectedGemeinde: (g: any) => void
  maxDeviation: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!geoData) return

    const geoJsonLayer = new L.GeoJSON(geoData, {
      style: (feature: any) => {
        const bfs = feature.properties.BFS
        const dev = deviationMap[bfs]
        const norm = Math.max(Math.min(dev / maxDeviation, 1), -1)

        let color = "#ccc"
        if (norm > 0) {
          const lightness = 90 - norm * 40
          color = `hsl(0, 70%, ${lightness}%)`
        } else if (norm < 0) {
          const absNorm = Math.abs(norm)
          const lightness = 90 - absNorm * 40
          color = `hsl(220, 70%, ${lightness}%)`
        } else {
          color = "#eeeeee"
        }

        return {
          fillColor: color,
          fillOpacity: 0.75,
          color: "#333",
          weight: 1,
        }
      },
      onEachFeature: (feature, layer) => {
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
      }
    })

    geoJsonLayer.addTo(map)

    return () => {
      map.removeLayer(geoJsonLayer)
    }
  }, [geoData, deviationMap, map])

  return null
}
