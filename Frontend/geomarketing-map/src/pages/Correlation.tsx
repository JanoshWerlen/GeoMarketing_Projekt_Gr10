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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts"

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
  const [correlation, setCorrelation] = useState<{
    r: number,
    slope: number,
    intercept: number,
    equation: string
  } | null>(null)
  const [topCorrelations, setTopCorrelations] = useState<any[]>([])

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
    fetch("http://localhost:4000/api/analyse/korrelationen")
      .then(res => res.json())
      .then(json => {
        const filtered = json
          .filter((c: any) => Math.abs(c.r) >= 0.7)
          .sort((a: any, b: any) => Math.abs(b.r) - Math.abs(a.r))
        setTopCorrelations(filtered)
      })
  }, [])

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

  // Compute correlation and regression line
  useEffect(() => {
    // Guard: skip calculation if xKpi or yKpi is not selected
    if (!xKpi || !yKpi) {
      setCorrelation(null)
      return
    }
    let points: { x: number, y: number }[] = []
    if (mode === "classic") {
      points = data
        .filter(row => typeof row[xKpi] === "number" && typeof row[yKpi] === "number")
        .map(row => ({ x: row[xKpi], y: row[yKpi] }))
    } else if (mode === "average") {
      points = averages
        .filter(row => typeof row.x_avg === "number" && typeof row.y_avg === "number")
        .map(row => ({ x: row.x_avg, y: row.y_avg }))
    }
    if (points.length < 2) {
      setCorrelation(null)
      return
    }
    // Pearson correlation and linear regression
    const n = points.length
    const sumX = points.reduce((a, p) => a + p.x, 0)
    const sumY = points.reduce((a, p) => a + p.y, 0)
    const meanX = sumX / n
    const meanY = sumY / n
    const covXY = points.reduce((a, p) => a + (p.x - meanX) * (p.y - meanY), 0)
    const varX = points.reduce((a, p) => a + (p.x - meanX) ** 2, 0)
    const varY = points.reduce((a, p) => a + (p.y - meanY) ** 2, 0) // <-- fix: use meanY
    const r = covXY / Math.sqrt(varX * varY)
    const slope = covXY / varX
    const intercept = meanY - slope * meanX
    const equation = `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`
    setCorrelation({ r, slope, intercept, equation })
  }, [data, averages, xKpi, yKpi, mode, year])

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

  // Regression line for scatter plot
  const regressionLineDataset =
    correlation && (mode === "classic" ? data : averages).length > 1
      ? (() => {
          let points: { x: number, y: number }[] = []
          if (mode === "classic") {
            points = data
              .filter(row => typeof row[xKpi] === "number" && typeof row[yKpi] === "number")
              .map(row => ({ x: row[xKpi], y: row[yKpi] }))
          } else if (mode === "average") {
            points = averages
              .filter(row => typeof row.x_avg === "number" && typeof row.y_avg === "number")
              .map(row => ({ x: row.x_avg, y: row.y_avg }))
          }
          if (points.length < 2) return null
          const xs = points.map(p => p.x)
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const y1 = correlation.slope * minX + correlation.intercept
          const y2 = correlation.slope * maxX + correlation.intercept
          return {
            label: "Regression",
            data: [
              { x: minX, y: y1 },
              { x: maxX, y: y2 }
            ],
            type: "line" as const,
            borderColor: "#636363",
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 0,
            borderDash: [6, 4],
            datalabels: { display: false } // <-- Prevent datalabels on regression line
          }
        })()
      : null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-900">Korrelationen zwischen KPIs</h1>

      {correlation && (
  <div className="mb-4 px-6 py-3 bg-blue-50 rounded shadow flex flex-wrap gap-x-12 gap-y-2 items-center text-blue-900">
    <div className="flex items-center">
      <b>Pearson r:</b>&nbsp;<span className="inline-block min-w-[80px]">{correlation.r.toFixed(3)}</span>
    </div>

  </div>
)}

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Top-Korrelationen (|r| ≥ 0.7)</h2>
        <ResponsiveContainer width="100%" height={700}>
          <BarChart
            data={topCorrelations}
            margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            onClick={({ activePayload }) => {
              const pair = activePayload?.[0]?.payload?.pair
              if (pair && pair.includes(" vs ")) {
                const [a, b] = pair.split(" vs ")
                setXKpi(a)
                setYKpi(b)
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="pair"
              interval={0}
              angle={-60}
              textAnchor="end"
              tick={{ fontSize: 11 }}
              height={250}
            />
            <YAxis domain={[-1, 1]} />
            <RechartsTooltip formatter={(value: number) => value.toFixed(2)} />
            <Bar dataKey="r" isAnimationActive={false}
              label={{
                position: "insideTop",
                formatter: (val: number) => val.toFixed(2),
                fill: "#000",
                fontSize: 11
              }}>
              {topCorrelations.map((entry, index) => {
                const absR = Math.abs(entry.r)
                const colorIntensity = Math.floor(255 - absR * 150)
                const color = entry.r > 0
                  ? `rgb(${colorIntensity}, ${colorIntensity}, 255)` // blau für positiv
                  : `rgb(255, ${colorIntensity}, ${colorIntensity})` // rot für negativ
                return <Cell key={`cell-${index}`} fill={color} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

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
                (mode === "classic"
                  ? [
                      classicDataset,
                      ...(trackedDataset ? [trackedDataset] : []),
                      ...(regressionLineDataset ? [regressionLineDataset] : [])
                    ]
                  : [
                      averageDataset,
                      ...(regressionLineDataset ? [regressionLineDataset] : [])
                    ]) as any
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const raw = ctx.raw as any
                      return `${raw.label ? raw.label + ": " : ""}(${raw.x}, ${raw.y})`
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
