# GeoMarketing Project

A data-driven geo-marketing analytics platform for Swiss municipalities, combining spatial and statistical analysis with a modern backend, frontend, and data pipeline.

---

## What is this project?

This project enables interactive spatial and statistical analysis of Swiss municipalities ("Gemeinden") using a combination of Python (for data cleaning, ETL, and spatial statistics), PostgreSQL/PostGIS (for spatial data storage and queries), a Node.js/Express backend API, and a modern React/TypeScript frontend for visualization.

You can:
- Clean and prepare raw Excel data for Swiss municipalities.
- Integrate and manage spatial data (municipality boundaries) using PostGIS.
- Join and analyze spatial and KPI data, including spatial autocorrelation (Moran's I).
- Visualize KPIs, correlations, and spatial patterns on interactive maps and charts.

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
├── geomarketing_<date>.bak
└── README.md
```

---

## Requirements

- **Python 3.8+** (with pip)
- **Node.js 16+** and npm
- **PostgreSQL 13+** with **PostGIS** extension enabled
- **Jupyter Notebook** (for running `Project.ipynb`)
- **Shapefile** of Swiss municipalities (see `Gemeindegrenzen/UP_GEMEINDEN_F.shp`)
- **Raw Excel data** (see `Data/Raw_Data.xlsx`)

---

## Setup Instructions

### 1. Clone the repository

```sh
git clone <your-repo-url>
cd Project
```

### 2. Configure Environment Variables

Copy `.env` to your project root and fill in your database credentials:

```
LOCAL_DB_URL=postgresql://postgres:<password>@localhost:5432/geomarketing
NEON_CONNECTION_STRING=postgresql://<user>:<pw>@<host>/<db>?sslmode=require
```

### 3. Import the Database (Optional)

A pre-built database backup (`geomarketing_<date>.bak`) is available in the project root.  
You can restore it to your local PostgreSQL instance using:

```sh
pg_restore --verbose --clean --if-exists --no-owner -d <your_local_db_url> geomarketing_<date>.bak
```

Replace `<your_local_db_url>` with your connection string (e.g. `postgresql://postgres:password@localhost:5432/geomarketing`).

This will save you time and allow you to skip the data cleaning and ETL steps if you just want to run the backend/frontend.

### 4. Prepare the Data (if not using the .bak)

- Place your raw Excel data in `Data/Raw_Data.xlsx`.
- Place the shapefile in `Gemeindegrenzen/UP_GEMEINDEN_F.shp` (and associated files).
- Open and run the notebook `Project.ipynb` step by step:
  - Cleans and uploads data to PostgreSQL using credentials from `.env`.
  - Loads and uploads the shapefile to PostGIS.
  - Creates the materialized view `gemeinden_merged` for efficient spatial/statistical queries.
  - Exports GeoJSONs and analysis results (e.g., `geo_kpi_*.geojson`, `moran_results.json`) directly into `Frontend/geomarketing-map/public/data/` for use in the frontend.
  - See the notebook for code to export additional KPIs or years as needed.

### 5. Start the Backend

```sh
cd Backend
npm install
node server.js
```
- The API runs at [http://localhost:4000](http://localhost:4000).
- The backend connects to the database using the `LOCAL_DB_URL` or `NEON_CONNECTION_STRING` from `.env`.

### 6. Start the Frontend

```sh
cd Frontend/geomarketing-map
npm install
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



## License

For academic use only.