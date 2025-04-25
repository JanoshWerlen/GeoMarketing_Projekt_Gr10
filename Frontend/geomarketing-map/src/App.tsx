import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import MapPage from "./pages/MapPage"
import MoranChart from "./pages/MoranCharts"
import CorrelationScatterPage from "./pages/Correlation"
import GemeindeMoranMap from "./pages/GemeindeMoranMap"

function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <nav className="flex gap-3 p-4 bg-white shadow rounded-xl mb-6 items-center">
      <button
        className={`px-4 py-1 rounded-full transition font-semibold ${
          location.pathname === "/" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-blue-50"
        }`}
        onClick={() => navigate("/")}
      >
        Map
      </button>
      <button
        className={`px-4 py-1 rounded-full transition font-semibold ${
          location.pathname === "/moran" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-blue-50"
        }`}
        onClick={() => navigate("/moran")}
      >
        Moran's I Chart
      </button>
      <button
        className={`px-4 py-1 rounded-full transition font-semibold ${
          location.pathname === "/correlation" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-blue-50"
        }`}
        onClick={() => navigate("/correlation")}
      >
        Correlation Scatter
      </button>
      <button
        className={`px-4 py-1 rounded-full transition font-semibold ${
          location.pathname === "/gemeinde-moran" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-blue-50"
        }`}
        onClick={() => navigate("/gemeinde-moran")}
      >
        Gemeinde Moran Map
      </button>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/moran" element={<MoranChart />} />
        <Route path="/correlation" element={<CorrelationScatterPage />} />
        <Route path="/gemeinde-moran" element={<GemeindeMoranMap />} />
      </Routes>
    </BrowserRouter>
  )
}
