import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts"

export default function AnalysePage() {
  const [correlations, setCorrelations] = useState<any[]>([])
  const [clusters, setClusters] = useState<any[]>([])
  const [outliers, setOutliers] = useState<any[]>([])

  useEffect(() => {
    fetch("http://localhost:4000/api/analyse/korrelationen")
      .then(res => res.json())
      .then(setCorrelations)

    fetch("http://localhost:4000/api/analyse/cluster")
      .then(res => res.json())
      .then(setClusters)

    fetch("http://localhost:4000/api/analyse/outliers")
      .then(res => res.json())
      .then(setOutliers)
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-900">Automatische Analyse</h1>

      {/* Korrelationen */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Top-Korrelationen (|r| &gt; 0.6)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={correlations.filter(c => Math.abs(c.r) > 0.6)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="pair" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" />
            <YAxis domain={[-1, 1]} />
            <Tooltip formatter={(value: number) => value.toFixed(2)} />
            <Legend />
            <Bar dataKey="r" fill="#4682b4">
              <LabelList dataKey="r" position="top" formatter={(v: number) => v.toFixed(2)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Cluster */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Cluster (nach Steuerkraft, Bauinvestition, Unternehmen)</h2>
        {clusters.length > 0 ? (
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={clusters} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="GEBIET_NAME" type="category" width={180} />
              <Tooltip />
              <Bar dataKey="Cluster" fill="#6baed6">
                <LabelList dataKey="Cluster" position="right" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-600">Keine Clusterdaten verfügbar.</p>
        )}
      </section>

      {/* Ausreißer */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Ausreißer (z. B. hohe Steuerkraft trotz niedriger Unternehmen)</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm border">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-2 py-1">Gemeinde</th>
                <th className="px-2 py-1 text-right">Steuerkraft</th>
                <th className="px-2 py-1 text-right">Neugründungen</th>
                <th className="px-2 py-1 text-right">Cluster</th>
              </tr>
            </thead>
            <tbody>
              {outliers.map((o, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-2 py-1">{o.GEBIET_NAME}</td>
                  <td className="px-2 py-1 text-right">
                    {Number(o["Steuerkraft pro Kopf"]) > 0
                      ? Number(o["Steuerkraft pro Kopf"]).toFixed(0)
                      : "?"}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {o["Anzahl Neugründungen Unternehmen"] ?? "?"}
                  </td>
                  <td className="px-2 py-1 text-right">{o.Cluster ?? "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
