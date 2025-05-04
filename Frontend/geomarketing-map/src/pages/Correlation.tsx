import { useEffect, useState } from "react"
import {
  Scatter,
  Line
} from "react-chartjs-2"
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Title,
  LineElement,
  CategoryScale
} from "chart.js"
import ChartDataLabels from "chartjs-plugin-datalabels"

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, Title, LineElement, CategoryScale, ChartDataLabels)

type Mode = "classic" | "average"

export default function CorrelationPage() {
  const [data, setData] = useState<any[]>([])
  const [averages, setAverages] = useState<any[]>([])
  const [kpiList, setKpiList] = useState<string[]>([])
  const [xKpi, setXKpi] = useState<string>("")
  const [yKpi, setYKpi] = useState<string>("")
  const [year, setYear] = useState<number>(2020)
  const [mode, setMode] = useState<Mode>("classic")
  const [trackedGemeinde, setTrackedGemeinde] = useState<string>("")
  const [gemeindeSearch, setGemeindeSearch] = useState<string>("")
  const [trackedOvertime, setTrackedOvertime] = useState<any[]>([])

  useEffect(() => {
    fetch(`http://localhost:4000/api/gemeinden-kpis?year=${year}`)
      .then(res => res.json())
      .then(json => {
        setData(json)
        const first = json[0] || {}
        const keys = Object.keys(first)
          .filter(k => typeof first[k] === "number" && k !== "BFS" && k !== "AREA_ROUND") // Exclude BFS and AREA_ROUND
        setKpiList(keys)
  
        // Preserve selected KPIs if they still exist
        if (!keys.includes(xKpi)) {
          setXKpi(keys[0] || "")
        }
        if (!keys.includes(yKpi)) {
          setYKpi(keys[1] || keys[0] || "")
        }
      })
  }, [year])
  

  useEffect(() => {
    if (mode === "average" && xKpi && yKpi) {
      fetch(`http://localhost:4000/api/gemeinden-kpi-averages?x=${xKpi}&y=${yKpi}`)
        .then(res => res.json())
        .then(json => setAverages(json))
    }
  }, [mode, xKpi, yKpi])

  // Fetch overtime data for tracked Gemeinde
  useEffect(() => {
    if (trackedGemeinde) {
      fetch(`http://localhost:4000/api/gemeinden-kpis?allYears=1&gemeinde=${encodeURIComponent(trackedGemeinde)}`)
        .then(res => res.json())
        .then(json => setTrackedOvertime(json))
    } else {
      setTrackedOvertime([])
    }
  }, [trackedGemeinde, xKpi, yKpi])

  const gemeindeNames = data.map(row => row.GEBIET_NAME).filter(Boolean)
  const filteredGemeindeNames = gemeindeNames.filter(name =>
    name.toLowerCase().includes(gemeindeSearch.toLowerCase())
  )

  const classicDataset = {
    label: `Gemeinden ${year}`,
    data: data
      .filter(row => typeof row[xKpi] === "number" && typeof row[yKpi] === "number" && row.GEBIET_NAME !== trackedGemeinde)
      .map(row => ({
        x: row[xKpi],
        y: row[yKpi],
        label: row.GEBIET_NAME
      })),
    backgroundColor: "#3182bd"
  }

  const trackedDataset = trackedGemeinde
    ? {
        label: `Tracked: ${trackedGemeinde}`,
        data: data
          .filter(row => row.GEBIET_NAME === trackedGemeinde && typeof row[xKpi] === "number" && typeof row[yKpi] === "number")
          .map(row => ({
            x: row[xKpi],
            y: row[yKpi],
            label: row.GEBIET_NAME
          })),
        backgroundColor: "#e6550d",
        pointRadius: 10,
        pointHoverRadius: 12
      }
    : null

  const averageDataset = {
    label: `Durchschnitt pro Jahr`,
    data: averages.map(row => ({
      x: row.x_avg,
      y: row.y_avg,
      label: row.Year
    })),
    backgroundColor: "#31a354"
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-900">Korrelationen zwischen KPIs</h1>

      <div className="flex flex-wrap gap-4 items-center mb-6 bg-white rounded-xl shadow px-6 py-4">
        <label>KPI X:</label>
        <select value={xKpi} onChange={e => setXKpi(e.target.value)} className="min-w-[140px]" >
          {kpiList.map(k => <option key={k}>{k}</option>)}
        </select>

        <label>KPI Y:</label>
        <select value={yKpi} onChange={e => setYKpi(e.target.value)} className="min-w-[140px]">
          {kpiList.map(k => <option key={k}>{k}</option>)}
        </select>

        <label>Modus:</label>
        <select value={mode} onChange={e => setMode(e.target.value as Mode)} className="min-w-[180px]">
          <option value="classic">Gemeinden (ein Jahr)</option>
          <option value="average">Durchschnitt je Jahr</option>
        </select>

        {mode === "classic" && (
          <>
            <label>Jahr:</label>
            <input
              type="range"
              min={2011}
              max={2023}
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="font-semibold text-blue-700">{year}</span>
          </>
        )}

        <label>Tracked Gemeinde:</label>
        <input
          type="text"
          placeholder="Suche Gemeinde..."
          value={gemeindeSearch}
          onChange={e => setGemeindeSearch(e.target.value)}
          className="min-w-[120px]"
        />
        <select value={trackedGemeinde} onChange={e => setTrackedGemeinde(e.target.value)} className="min-w-[140px]">
          <option value="">Keine</option>
          {filteredGemeindeNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-8">
        <div className="h-[500px] w-1/2 bg-white rounded-xl shadow p-4">
          <Scatter
            data={{
              datasets:
                mode === "classic"
                  ? [classicDataset, ...(trackedDataset ? [trackedDataset] : [])]
                  : [averageDataset]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const raw = ctx.raw as any
                      return `${raw.label}: (${raw.x}, ${raw.y})`
                    }
                  }
                },
                title: {
                  display: true,
                  text: `${yKpi} vs ${xKpi} (${mode === "classic" ? `Gemeinden ${year}` : "Jahresdurchschnitt"})`
                },
                datalabels: mode === "average"
                  ? {
                      align: "right",
                      anchor: "end",
                      font: { weight: "bold" },
                      color: "#31a354",
                      formatter: function(value: any) {
                        return value.label
                      }
                    }
                  : {
                      display: false
                    }
              },
              scales: {
                x: { title: { display: true, text: xKpi } },
                y: { title: { display: true, text: yKpi } }
              }
            }}
            plugins={[ChartDataLabels]}
          />
        </div>
        <div className="h-[500px] w-1/2 bg-white rounded-xl shadow p-4">
          {trackedGemeinde && trackedOvertime.length > 0 ? (
            <Line
              data={{
                labels: trackedOvertime.map(row => row.JAHR || row.Year),
                datasets: [
                  {
                    label: xKpi,
                    data: trackedOvertime.map(row => row[xKpi]),
                    borderColor: "#3182bd",
                    backgroundColor: "#3182bd22",
                    yAxisID: "y1"
                  },
                  {
                    label: yKpi,
                    data: trackedOvertime.map(row => row[yKpi]),
                    borderColor: "#e6550d",
                    backgroundColor: "#e6550d22",
                    yAxisID: "y2"
                  }
                ]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "top" },
                  title: {
                    display: true,
                    text: `Verlauf für "${trackedGemeinde}": ${xKpi} & ${yKpi} über die Jahre`
                  }
                },
                scales: {
                  x: { title: { display: true, text: "Jahr" } },
                  y1: {
                    type: "linear",
                    display: true,
                    position: "left",
                    title: { display: true, text: xKpi }
                  },
                  y2: {
                    type: "linear",
                    display: true,
                    position: "right",
                    title: { display: true, text: yKpi },
                    grid: { drawOnChartArea: false }
                  }
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              {trackedGemeinde ? "Keine Zeitreihendaten gefunden." : "Wähle eine Gemeinde zum Anzeigen des Verlaufs."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
