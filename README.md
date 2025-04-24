# GeoMarketing Project

A data-driven geo-marketing analytics platform for Swiss municipalities, combining spatial and statistical analysis with a modern backend and data pipeline.

---

## Features

- **Data Cleaning & Preparation**: Automated cleaning, imputation, and deduplication of raw Excel data.
- **Spatial Data Integration**: Upload and manage municipality boundaries using PostGIS.
- **Data Merging**: Materialized view joining spatial and KPI data for efficient querying.
- **Backend API**: Express.js server with endpoints for municipality details.
- **Spatial Analysis**: Moran's I spatial autocorrelation for all KPIs and years.
- **GeoJSON Export**: Export KPI maps for frontend visualization.

---

## Project Structure

```
Project/
├── Backend/
│   └── server.js
├── Data/
│   ├── Raw_Data.xlsx
│   └── Cleaned_Data.xlsx
├── Gemeindegrenzen/
│   └── UP_GEMEINDEN_F.shp
├── Frontend/
│   └── geomarketing-map/
│       └── public/
│           └── data/
│               ├── geo_kpi_*.geojson
│               ├── moran_results.csv
│               └── moran_results.json
├── Project.ipynb
├── .env
└── README.md
```

---

## Environment Setup

- Copy `.env` to your project root and fill in your database credentials:
  ```
  LOCAL_DB_USER=postgres
  LOCAL_DB_PASSWORD=yourpassword
  LOCAL_DB_HOST=localhost
  LOCAL_DB_PORT=5432
  LOCAL_DB_NAME=geomarketing
  NEON_CONNECTION=your_neon_connection_string
  ```
- The Jupyter notebook and backend will read credentials from this file.

---

## Usage

### 1. Data Preparation

- Place your raw Excel data in `Data/Raw_Data.xlsx`.
- Open and run the notebook `Project.ipynb` step by step:
  - Cleans and uploads data to PostgreSQL using credentials from `.env`.
  - Loads and uploads the shapefile (`Gemeindegrenzen/UP_GEMEINDEN_F.shp`) to PostGIS.
  - Creates the materialized view `gemeinden_merged` for efficient spatial/statistical queries.
  - Exports GeoJSONs and analysis results (e.g., `geo_kpi_*.geojson`, `moran_results.json`) directly into `Frontend/geomarketing-map/public/data/` for use in the frontend.
  - See the notebook for code to export additional KPIs or years as needed.

---

### 2. Backend

- Install dependencies in the `Backend/` directory:
  ```
  cd Backend
  npm install
  ```
- Start the server:
  ```
  node server.js
  ```
- The API runs at [http://localhost:4000](http://localhost:4000).
- The backend connects to the Neon database using the `NEON_CONNECTION` string from `.env`.

### 3. Frontend

- The frontend is implemented in [`Frontend/geomarketing-map/`](Frontend/geomarketing-map).
- Place all exported GeoJSON and analysis result files (from the notebook) in `Frontend/geomarketing-map/public/data/`.
- Install frontend dependencies:
  ```
  cd Frontend/geomarketing-map
  npm install
  ```
- Start the frontend development server:
  ```
  npm run dev
  ```
- The frontend will be available at [http://localhost:5173](http://localhost:5173) (or as indicated by Vite).
- The app provides interactive maps, KPI visualizations, correlation plots, and spatial analysis dashboards using the exported data and the backend API.

---

## Example API Usage

Get municipality details:
```
GET http://localhost:4000/api/gemeinde-details?bfs={BFS_NR}&year={Year}
```

---

## Authors

Janosh Werlen, ZHAW, Semester 8

---

## License

For academic use only.