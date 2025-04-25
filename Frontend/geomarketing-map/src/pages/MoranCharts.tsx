import { useEffect, useState } from "react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    BarChart,
    Bar,
    LabelList,
} from "recharts"

type MoranResult = {
  Year: number
  KPI: string
  Moran_I: number
  p_value: number
}

export default function MoranChart() {
  const [data, setData] = useState<MoranResult[]>([])
  const [kpis, setKpis] = useState<string[]>([])
  const [selectedKpi, setSelectedKpi] = useState<string>("")
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  useEffect(() => {
    fetch("/data/moran_results.json")
      .then((res) => res.json())
      .then((json: MoranResult[]) => {
        setData(json)
        const uniqueKPIs = [...new Set(json.map((d) => d.KPI))].sort()
        setKpis(uniqueKPIs)
        setSelectedKpi(uniqueKPIs[0])
        const uniqueYears = [...new Set(json.map((d) => d.Year))].sort((a, b) => a - b)
        setYears(uniqueYears)
        setSelectedYear(uniqueYears[uniqueYears.length - 1])
      })
  }, [])

  const filtered = data.filter((d) => d.KPI === selectedKpi)

  // Get all KPIs' Moran_I for the selected year, sorted descending
  const moranByKpiForYear =
    selectedYear !== null
      ? data
          .filter((d) => d.Year === selectedYear)
          .sort((a, b) => b.Moran_I - a.Moran_I)
      : []

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-900">Moran's I over Time</h1>
      <div className="flex items-center gap-3 mb-4 bg-white rounded-xl shadow px-6 py-4 w-fit">
        <label className="font-semibold mr-2">KPI:</label>
        <select value={selectedKpi} onChange={(e) => setSelectedKpi(e.target.value)} className="min-w-[180px]">
          {kpis.map((kpi) => (
            <option key={kpi} value={kpi}>
              {kpi}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 h-[400px] bg-white rounded-xl shadow p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Year" />
            <YAxis domain={[-1, 1]} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="Moran_I"
              stroke="#3182bd"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar chart for all KPIs' Moran's I for selected year */}
      {selectedYear && (
        <div className="mt-10 h-[420px] bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="font-semibold text-blue-900 text-lg">
              Moran's I by KPI
            </div>
            <div>
              <label className="mr-2 font-medium">Year:</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="min-w-[100px]"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={moranByKpiForYear}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[-1, 1]} />
              <YAxis
                dataKey="KPI"
                type="category"
                width={180}
                tick={{ fontSize: 13 }}
              />
              <Tooltip />
              <ReferenceLine x={0} stroke="#999" strokeDasharray="3 3" />
              <Bar dataKey="Moran_I" fill="#3182bd">
                <LabelList dataKey="Moran_I" position="right" formatter={(v: number) => v.toFixed(2)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
