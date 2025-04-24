import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import MapPage from "./pages/MapPage"
import MoranChart from "./pages/MoranCharts"
import CorrelationScatterPage from "./pages/Correlation"

function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <div className="flex gap-4 p-4 bg-gray-200">
      <button
        className={location.pathname === "/" ? "font-bold underline" : ""}
        onClick={() => navigate("/")}
      >
        Map
      </button>
      <button
        className={location.pathname === "/moran" ? "font-bold underline" : ""}
        onClick={() => navigate("/moran")}
      >
        Moran's I Chart
      </button>
      <button
        className={location.pathname === "/correlation" ? "font-bold underline" : ""}
        onClick={() => navigate("/correlation")}
      >
        Correlation Scatter
      </button>
    </div>
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
      </Routes>
    </BrowserRouter>
  )
}
