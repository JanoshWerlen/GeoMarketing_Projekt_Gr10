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

  useEffect(() => {
    fetch("/data/moran_results.json")
      .then((res) => res.json())
      .then((json: MoranResult[]) => {
        setData(json)
        const uniqueKPIs = [...new Set(json.map((d) => d.KPI))].sort()
        setKpis(uniqueKPIs)
        setSelectedKpi(uniqueKPIs[0])
      })
  }, [])

  const filtered = data.filter((d) => d.KPI === selectedKpi)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Moran's I over Time</h1>
      <label className="font-semibold mr-2">KPI:</label>
      <select value={selectedKpi} onChange={(e) => setSelectedKpi(e.target.value)}>
        {kpis.map((kpi) => (
          <option key={kpi} value={kpi}>
            {kpi}
          </option>
        ))}
      </select>

      <div className="mt-6 h-[400px]">
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
    </div>
  )
}
