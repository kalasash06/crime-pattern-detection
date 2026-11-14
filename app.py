from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np

app = Flask(__name__)

# ---------- Load + clean ----------
raw = pd.read_csv("data/crime_data.csv")
raw = raw[~raw["District"].str.lower().str.startswith("total")]

# One row per state-year. The "Property" column holds several sub-type rows plus a
# "Total Property" row (the largest), so max() picks the total.
df = raw.groupby(["District", "Year"], as_index=False).agg(
    Rape=("Rape", "max"), Theft=("Theft", "max"), Property=("Property", "max")
)
CRIMES = ["Rape", "Theft", "Property"]

# ---------- Risk score ----------
for c in CRIMES:
    df[c + "_N"] = df[c] / df[c].max()
df["Total"] = df[[c + "_N" for c in CRIMES]].sum(axis=1)
LOW = df["Total"].quantile(0.33)
HIGH = df["Total"].quantile(0.66)

STATES = sorted(df["District"].unique())
YEARS = sorted(int(y) for y in df["Year"].unique())


def risk_label(total):
    if total >= HIGH:
        return "HIGH", "This area shows consistently high crime levels. Immediate attention required."
    if total >= LOW:
        return "MEDIUM", "Moderate crime activity detected. Preventive measures recommended."
    return "LOW", "This area is relatively safe with lower crime rates."


def series_for(state):
    """Yearly totals per crime for one state, or all of India."""
    if state == "All India":
        g = df.groupby("Year")[CRIMES].sum().reset_index()
    else:
        g = df[df["District"] == state].sort_values("Year")
    return g


def forecast(years, values, n=5):
    if len(years) < 2:
        return [], []
    slope, intercept = np.polyfit(years, values, 1)
    fy = list(range(int(max(years)) + 1, int(max(years)) + n + 1))
    return fy, [max(0, round(slope * y + intercept)) for y in fy]


# ---------- Pages + API ----------
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/meta")
def meta():
    return jsonify(states=STATES, years=YEARS, crimes=CRIMES)


@app.route("/api/overview")
def overview():
    year_totals = df.groupby("Year")[CRIMES].sum()
    totals = {c: int(df[c].sum()) for c in CRIMES}
    return jsonify(
        total_cases=int(sum(totals.values())),
        states=len(STATES),
        year_min=YEARS[0], year_max=YEARS[-1],
        top_crime=max(totals, key=totals.get),
        by_crime=totals,
        years=[int(y) for y in year_totals.index],
        trend={c: [int(v) for v in year_totals[c]] for c in CRIMES},
    )


@app.route("/api/state")
def state_view():
    state = request.args.get("state", "All India")
    g = series_for(state)
    years = [int(y) for y in g["Year"]]
    out = {"state": state, "years": years, "trend": {}, "forecast_years": [], "forecast": {}}
    for c in CRIMES:
        vals = [int(v) for v in g[c]]
        fy, fv = forecast(years, vals)
        out["trend"][c] = vals
        out["forecast"][c] = fv
        out["forecast_years"] = fy
    return jsonify(out)


@app.route("/api/heatmap")
def heatmap():
    year = int(request.args.get("year", YEARS[-1]))
    d = df[df["Year"] == year].copy()
    d["T"] = d[CRIMES].sum(axis=1)
    top = d.sort_values("T", ascending=False).head(15)
    matrix = []
    for c in CRIMES:
        mx = top[c].max() or 1
        matrix.append([round(float(v) / float(mx), 2) for v in top[c]])
    return jsonify(year=year, states=list(top["District"]), crimes=CRIMES, matrix=matrix)


@app.route("/api/predict")
def predict():
    state = request.args.get("state")
    year = int(request.args.get("year", YEARS[-1]))
    d = df[df["District"] == state].sort_values("Year")
    if d.empty:
        return jsonify(error="State not found"), 404

    # Next 5 years: straight-line trend per crime, scored with the same risk rules
    years = [int(y) for y in d["Year"]]
    fy, fvals = [], {}
    for c in CRIMES:
        fy, fvals[c] = forecast(years, [float(v) for v in d[c]])
    future = []
    for i, y in enumerate(fy):
        score = sum(float(fvals[c][i]) / float(df[c].max()) for c in CRIMES)
        future.append({
            "year": int(y), "score": round(score, 2), "level": risk_label(score)[0],
            "values": {c: int(fvals[c][i]) for c in CRIMES},
        })

    # If a future year was picked, use its forecast; otherwise use real data
    chosen = next((f for f in future if f["year"] == year), None)
    if chosen:
        values, score, year_used, is_fc = chosen["values"], chosen["score"], year, True
    else:
        row = d.iloc[(d["Year"] - year).abs().argsort()[:1]].iloc[0]
        values = {c: int(row[c]) for c in CRIMES}
        score, year_used, is_fc = round(float(row["Total"]), 2), int(row["Year"]), False

    level, insight = risk_label(score)
    top = max(CRIMES, key=lambda c: values[c])
    return jsonify(
        state=state, year_used=year_used, forecast=is_fc, level=level, insight=insight,
        score=score, top_crime=top, top_value=values[top], values=values,
        future=future, low=round(float(LOW), 2), high=round(float(HIGH), 2),
    )


@app.route("/api/ranking")
def ranking():
    year = int(request.args.get("year", YEARS[-1]))
    d = df[df["Year"] == year].sort_values("Total", ascending=False).head(10)
    return jsonify(year=year, items=[
        {"state": r.District, "score": round(float(r.Total), 2), "level": risk_label(r.Total)[0]}
        for r in d.itertuples()
    ])

@app.route("/api/map")
def map_data():
    year = int(request.args.get("year", YEARS[-1]))
    metric = request.args.get("metric", "Total")
    if metric not in CRIMES + ["Total"]:
        metric = "Total"
    d = df[df["Year"] == year]
    vals = {k: float(v) for k, v in d.set_index("District")[metric].items()}
    return jsonify(year=year, metric=metric, values=vals, max=max(vals.values()) or 1)

if __name__ == "__main__":
    app.run(debug=True)