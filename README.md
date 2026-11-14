# India Safe: Crime Pattern Detection and Risk Prediction

An interactive dashboard that explores state-wise crime data for India (2001-2010), maps where crime is concentrated, and estimates a risk level for any state and year, including a 5-year outlook.

**Live demo:** _add your Render link here_

## Features

- **Overview dashboard:** headline numbers (total cases, states/UTs covered, year range, most common crime) with an all-India trend and forecast.
- **State analysis:** pick any state or UT and see its historical trend and a 5-year forecast per crime type.
- **Yearly trends:** cases per year for Property, Theft and Rape.
- **Heatmap view:** a choropleth map of India (Leaflet) coloured by overall risk score or by a single crime type, plus a top-15 states heatmap grid.
- **Crime categories:** share of recorded cases by crime type and a top-10 highest-risk states ranking.
- **Risk prediction:** a LOW / MEDIUM / HIGH rating for a chosen state and year, with a trend-based outlook for the next 5 years.

## How the risk score works

This is a **rule-based risk scoring system**, not a trained machine-learning model.

1. Each crime count (Rape, Theft, Property) is divided by its maximum value across the dataset, giving a 0 to 1 scale.
2. The three scaled values are added to give a risk score from 0 to 3.
3. Scores at or above the 66th percentile are **HIGH**, those at or above the 33rd percentile are **MEDIUM**, and the rest are **LOW**.

**Forecasts** are a straight-line (linear regression) trend fitted to each state's yearly counts using NumPy and projected 5 years ahead, then scored with the same rules. With only 10 years of history, treat forecasts as indicative rather than precise.

## Tech stack

- **Backend:** Python, Flask, Pandas, NumPy
- **Frontend:** HTML, CSS, JavaScript, Chart.js, Leaflet
- **Deployment:** Render with Gunicorn

## Project structure

```
crime-pattern-detection/
├── app.py                 # Flask app and JSON API
├── data_processing.py     # Merges the raw CSVs into data/crime_data.csv
├── requirements.txt
├── data/                  # Source CSVs and the merged crime_data.csv
├── templates/
│   └── index.html         # Dashboard page
└── static/
    ├── style.css
    └── app.js             # Charts, map and page logic
```

## API endpoints

| Endpoint | Returns |
|---|---|
| `/api/meta` | List of states, years and crime types |
| `/api/overview` | Totals, year range and all-India trend |
| `/api/state?state=...` | Yearly trend and 5-year forecast for a state (or `All India`) |
| `/api/heatmap?year=...` | Top 15 states, scaled per crime type |
| `/api/map?year=...&metric=...` | State values for the India map |
| `/api/predict?state=...&year=...` | Risk level, score and 5-year outlook |
| `/api/ranking?year=...` | Top 10 states by risk score |

## Run locally

```bash
git clone https://github.com/kalasash06/crime-pattern-detection.git
cd crime-pattern-detection
python -m venv venv
venv\Scripts\activate        # Windows (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000.

`data/crime_data.csv` is already included. You only need to run `python data_processing.py` if you change the source CSVs.

## Deploy on Render

1. Push the project to GitHub.
2. On Render, choose **New, Web Service** and connect the repository.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. Deploy. Every push to the repository redeploys automatically.

The free tier sleeps after a period of inactivity, so the first load can take about a minute.

## Data notes

- The merged CSV contains several rows per state-year, because the property dataset has one row per property type plus a "Total Property" row. The app keeps one row per state-year by taking the maximum value, which is the total row, so nothing is double counted.
- The dataset covers 2001-2010, so Telangana and Ladakh are shown on the map with the values of Andhra Pradesh and Jammu & Kashmir respectively.

## Limitations

- Risk levels are relative to the other states and years in this dataset, not an absolute measure of safety.
- Counts are not adjusted for population, so large states naturally score higher.
- Forecasts use a simple linear trend and do not account for policy changes or other external factors.

## Credits

Originally built as a team project by [carolynaids24-afk](https://github.com/carolynaids24-afk/crime-risk-prediction). This version is a fork with a redesigned dashboard, data cleaning fix, India map and 5-year forecasting.
