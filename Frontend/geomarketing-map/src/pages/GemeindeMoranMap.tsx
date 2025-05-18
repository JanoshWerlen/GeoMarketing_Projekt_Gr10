import { useEffect, useState, useCallback, useLayoutEffect } from "react"
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"
import "leaflet/dist/leaflet.css"

// Types
type Gemeinde = {
  id: string
  name: string
}

type MoranScore = {
  gemeinde_id: string
  moran_i: number
}

type Adjacency = {
  [gemeinde_id: string]: string[]
}

const YEAR = 2023

async function fetchGemeinden(): Promise<Gemeinde[]> {
  const res = await fetch("/data/gemeinden_geometry.geojson")
  const geojson = await res.json()
  return geojson.features.map((f: any) => ({
    id: f.properties.id,
    name: f.properties.name || f.properties.GEMEINDENA
  }))
}

// Fetch all KPIs for all Gemeinden for the selected year
async function fetchKpiData(): Promise<any[]> {
  // Use the same endpoint as MapPage
  const res = await fetch(`http://localhost:4000/api/gemeinden-kpis?year=${YEAR}`)
  if (!res.ok) return []
  return res.json()
}

// Fetch Moran scores for a given KPI
async function fetchMoranScores(kpi: string): Promise<MoranScore[]> {
  const res = await fetch(`/api/moran-scores?year=${YEAR}&kpi=${encodeURIComponent(kpi)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((g: any) => ({
    gemeinde_id: g.BFS?.toString() ?? g.gemeinde_id?.toString(),
    moran_i: g.Moran_I ?? g.moran_i ?? null,
  }))
}

// Fetch Moran scores for a given KPI and a list of Gemeinde IDs
async function fetchMoranScoresSubset(kpi: string, gemeindeIds: string[]): Promise<MoranScore[]> {
  // Backend endpoint expects: /api/moran-scores?year=...&kpi=...&gemeinden=1,2,3
  const params = new URLSearchParams({
    year: YEAR.toString(),
    kpi: kpi,
    gemeinden: gemeindeIds.join(","),
  });
  const res = await fetch(`http://localhost:4000/api/moran-scores?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((g: any) => ({
    gemeinde_id: g.BFS?.toString() ?? g.gemeinde_id?.toString(),
    moran_i: g.Moran_I ?? g.moran_i ?? null,
  }));
}

async function fetchAdjacency(): Promise<Adjacency> {
  const res = await fetch("/data/gemeinden_geometry.geojson")
  const geojson = await res.json()
  const adj: Adjacency = {}
  geojson.features.forEach((f: any) => {
    const id = f.properties.id
    const neighbors = f.properties.adjacent_BFS || []
    adj[id] = neighbors
  })
  return adj
}

async function fetchGemeindeGeoJSON(): Promise<any> {
  const res = await fetch("/data/gemeinden_geometry.geojson")
  return res.json()
}

function MoranLegend() {
  const colors = [
    { color: "#08519c", label: "> 0.5" },
    { color: "#6baed6", label: "0.2 – 0.5" },
    { color: "#c6dbef", label: "0 – 0.2" },
    { color: "#f7f7f7", label: "-0.2 – 0" },
    { color: "#fcbba1", label: "-0.5 – -0.2" },
    { color: "#cb181d", label: "< -0.5" },
    { color: "#eee", label: "Nicht ausgewählt" },
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
        Moran's I Skala
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {colors.map(({ color, label }, i) => (
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
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GemeindeMoranMap() {
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>([])
  const [moranScores, setMoranScores] = useState<MoranScore[]>([])
  const [adjacency, setAdjacency] = useState<Adjacency>({})
  const [geojson, setGeojson] = useState<any>(null)
  const [selectedId, setSelectedId] = useState<string>("")
  const [popupOpen, setPopupOpen] = useState(false)
  const [kpiList, setKpiList] = useState<string[]>([])
  const [selectedKpi, setSelectedKpi] = useState<string>("")

  // Prevent body scrolling (like MapPage)
  useLayoutEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // Fetch KPIs and Gemeinden on mount
  useEffect(() => {
    fetchGemeinden().then(setGemeinden)
    fetchAdjacency().then(setAdjacency)
    fetchGemeindeGeoJSON().then(setGeojson)
    fetchKpiData().then(data => {
      // Extract KPI names like in MapPage
      const first = data[0] || {}
      const allKpis = Object.keys(first).filter(
        k => typeof first[k] === "number" && k !== "BFS" && k !== "AREA_ROUND"
      )
      setKpiList(allKpis)
      if (allKpis.length > 0) setSelectedKpi(allKpis[0])
    })
  }, [])

  // Fetch Moran scores for selected Gemeinde + neighbors when both are selected
  useEffect(() => {
    if (selectedKpi && selectedId) {
      // Fetch adjacency if not yet loaded
      const fetchScores = async () => {
        const ids = [selectedId, ...(adjacency[selectedId] || [])];
        const uniqueIds = Array.from(new Set(ids));
        const scores = await fetchMoranScoresSubset(selectedKpi, uniqueIds);
        setMoranScores(scores);
      };
      fetchScores();
    } else if (selectedKpi) {
      // If no Gemeinde selected, fetch all (fallback)
      fetchMoranScores(selectedKpi).then(setMoranScores);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKpi, selectedId, adjacency]);

  const selectedGemeinde = gemeinden.find(g => g.id === selectedId)
  const selectedMoran = moranScores.find(m => m.gemeinde_id === selectedId)?.moran_i
  const adjacentIds = selectedId ? adjacency[selectedId] || [] : []

  const highlightedIds = selectedId ? [selectedId, ...(adjacency[selectedId] || [])] : [];
  const highlightedScores = moranScores.filter(m => highlightedIds.includes(m.gemeinde_id));

  const neighborsWithScores = adjacentIds
    .map(id => {
      const gemeinde = gemeinden.find(g => g.id === id)
      const moran = moranScores.find(m => m.gemeinde_id === id)?.moran_i
      return {
        id,
        name: gemeinde?.name ?? id,
        moran_i: moran,
      }
    })
    .filter(n => n != null)
    .sort((a, b) => (b.moran_i ?? -Infinity) - (a.moran_i ?? -Infinity))

  const comparisonList = [
    {
      id: selectedId,
      name: selectedGemeinde?.name ?? selectedId,
      moran_i: selectedMoran,
      isSelf: true,
    },
    ...neighborsWithScores.map(n => ({ ...n, isSelf: false })),
  ].filter(n => n.id)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setPopupOpen(false)
  }, [])

  useEffect(() => {
    if (popupOpen) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [popupOpen, handleKeyDown])

  function getColor(score: number | null | undefined): string {
    if (score == null) return "#ccc"
    if (score > 0.5) return "#08519c"
    if (score > 0.2) return "#6baed6"
    if (score > 0) return "#c6dbef"
    if (score > -0.2) return "#f7f7f7"
    if (score > -0.5) return "#fcbba1"
    return "#cb181d"
  }

  function style(feature: any) {
    const id = feature.properties.id;
    const score = moranScores.find(m => m.gemeinde_id === id)?.moran_i;
    const isSelected = id === selectedId;
    const isNeighbor = adjacency[selectedId]?.includes(id);
    const isHighlighted = highlightedIds.includes(id);

    // Selected polygon: always show Moran color, thick border
    if (isSelected) {
      return {
        color: "#000",
        weight: 4,
        fillColor: getColor(score),
        fillOpacity: 0.9,
        dashArray: undefined,
      };
    }
    // Neighbor polygons: show Moran color, medium border
    if (isNeighbor) {
      return {
        color: "#555",
        weight: 2,
        fillColor: getColor(score),
        fillOpacity: 0.7,
        dashArray: "4",
      };
    }
    // All others: grey fill, thin border
    return {
      color: "#999",
      weight: 1,
      fillColor: "#e5e7eb",
      fillOpacity: 0.5,
      dashArray: undefined,
    };
  }

  // Helper to get the correct moran score for a feature
  function getFeatureMoranScore(feature: any) {
    const id = feature.properties.id?.toString();
    const bfs = feature.properties.BFS?.toString();
    // Try all possible matches
    let moranScore = moranScores.find(
      m => m.gemeinde_id === id || m.gemeinde_id === bfs
    )?.moran_i;
    if (moranScore === undefined) {
      moranScore = moranScores.find(
        m => m.gemeinde_id == bfs || m.gemeinde_id == id
      )?.moran_i;
    }
    return moranScore;
  }

  // --- Sort highlightedIds by moran score descending for popup table ---
  const highlightedIdsSorted = [...highlightedIds].sort((a, b) => {
    const aScore = moranScores.find(m => m.gemeinde_id === a)?.moran_i ?? -Infinity;
    const bScore = moranScores.find(m => m.gemeinde_id === b)?.moran_i ?? -Infinity;
    return bScore - aScore;
  });

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      <h1 className="text-xl font-bold mb-4 text-blue-900">Gemeinde Karte Moran</h1>
      <div className="p-4 bg-white shadow rounded-xl z-10 flex-shrink-0 mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <label className="font-semibold mr-2">KPI:</label>
          <select
            value={selectedKpi}
            onChange={e => setSelectedKpi(e.target.value)}
            className="min-w-[180px] mr-4"
          >
            {kpiList.map(kpi => (
              <option key={kpi} value={kpi}>{kpi}</option>
            ))}
          </select>
          <label className="font-semibold mr-2">Gemeinde:</label>
          <select
            value={selectedId}
            onChange={e => {
              setSelectedId(e.target.value)
              setPopupOpen(!!e.target.value)
            }}
            className="min-w-[220px]"
          >
            <option value="">Select Gemeinde</option>
            {gemeinden.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {selectedId && (
            <span className="ml-6 font-medium text-blue-900">
              Moran's I: <span className="font-mono">{selectedMoran !== undefined ? selectedMoran.toFixed(3) : "N/A"}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <MoranLegend />
        {popupOpen && selectedId && (
          <div
            className="absolute top-4 left-4 text-black rounded-xl p-6 shadow-lg border border-gray-200 w-[450px] max-h-[80vh] overflow-y-auto z-[1000] bg-white"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedGemeinde?.name ?? "Unbekannt"}
              </h3>
              <button
                onClick={() => setPopupOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                title="Schliessen"
              >
                &times;
              </button>
            </div>
            <div className="text-sm text-gray-500 mb-2">
              BFS-Nr.: {selectedGemeinde?.id}
            </div>
            <div className="text-sm font-medium mb-4">
              Moran's I: <span className="font-mono">{selectedMoran !== undefined ? selectedMoran.toFixed(3) : "N/A"}</span>
            </div>
            <div className="mb-2 font-semibold">Vergleich mit Nachbarn:</div>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1">Gemeinde</th>
                  <th className="text-right px-2 py-1">Moran's I</th>
                </tr>
              </thead>
              <tbody>
                {highlightedIdsSorted.map(id => {
                  const gemeinde = gemeinden.find(g => g.id === id);
                  const moran = moranScores.find(m => m.gemeinde_id === id)?.moran_i;
                  return (
                    <tr key={id} className={id === selectedId ? "bg-blue-50 font-bold" : ""}>
                      <td className="px-2 py-1">
                        {gemeinde?.name ?? id}
                        {id === selectedId ? " (Ausgewählt)" : ""}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {moran !== undefined && moran !== null ? moran.toFixed(3) : "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <MapContainer
          center={[47.38, 8.54]}
          zoom={11}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {geojson && (
            <GeoJSON
              data={geojson}
              style={style}
              onEachFeature={(feature, layer) => {
                const name = feature.properties.name || feature.properties.GEMEINDENA || "Unbekannt";
                // Only show the name in the tooltip, no Moran's I
                layer.bindTooltip(
                  `<strong>${name}</strong>`,
                  { sticky: true, direction: "top", opacity: 0.9, className: "leaflet-tooltip", permanent: false }
                );

                const id = feature.properties.id?.toString();
                layer.on("click", () => {
                  setSelectedId(id);
                  setPopupOpen(true);
                });
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
