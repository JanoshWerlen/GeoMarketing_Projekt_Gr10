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
└── README.md
```

---

## Usage

### 1. Data Preparation

- Place your raw Excel data in `Data/Raw_Data.xlsx`.
- Run the notebook `Project.ipynb` step by step:
  - Cleans and uploads data to PostgreSQL.
  - Loads and uploads shapefile to PostGIS.
  - Creates the materialized view `gemeinden_merged`.
  - Exports GeoJSONs and runs spatial analysis.

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

### 3. Frontend

- Place exported GeoJSON and analysis results in `Frontend/geomarketing-map/public/data/`.
- (Frontend implementation not included in this repo.)

---

## Example API Usage

Get municipality details:
```
GET http://localhost:4000/api/municipality/{id}
```

---

## Authors

Janosh Werlen, ZHAW, Semester 8

---

## License

For academic use only.