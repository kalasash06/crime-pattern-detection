from flask import Flask, render_template, request
import pandas as pd
import matplotlib.pyplot as plt
import os

app = Flask(__name__)

# Load dataset
df = pd.read_csv("data/crime_data.csv")
df["District"] = df["District"].str.strip()

# 🔥 NORMALIZATION
df["Rape_N"] = df["Rape"] / df["Rape"].max()
df["Theft_N"] = df["Theft"] / df["Theft"].max()
df["Property_N"] = df["Property"] / df["Property"].max()

df["Total"] = df[["Rape_N", "Theft_N", "Property_N"]].sum(axis=1)

low_threshold = df["Total"].quantile(0.33)
high_threshold = df["Total"].quantile(0.66)

districts = sorted(df["District"].unique())
years = sorted(df["Year"].unique())

@app.route("/", methods=["GET", "POST"])
def home():
    prediction = None
    crime_info = None
    insight = None
    graph_path = None

    if request.method == "POST":
        district = request.form["district"]
        year = int(request.form["year"])

        filtered = df[(df["District"] == district) & (df["Year"] == year)]

        if filtered.empty:
            district_data = df[df["District"] == district]
            if not district_data.empty:
                filtered = district_data.iloc[
                    (district_data["Year"] - year).abs().argsort()[:1]
                ]

        if not filtered.empty:
            row = filtered.iloc[0]

            max_crime = row[["Rape", "Theft", "Property"]].idxmax()
            max_value = row[["Rape", "Theft", "Property"]].max()

            crime_info = f"Highest Crime: {max_crime} ({int(max_value)} cases)"

            total = row["Total"]

            if total >= high_threshold:
                prediction = "HIGH RISK ⚠️"
                insight = "This area shows consistently high crime levels. Immediate attention required."
            elif total >= low_threshold:
                prediction = "MEDIUM RISK ⚠️"
                insight = "Moderate crime activity detected. Preventive measures recommended."
            else:
                prediction = "LOW RISK ✅"
                insight = "This area is relatively safe with lower crime rates."

        # 📊 GRAPH
        district_data = df[df["District"] == district]

        if not district_data.empty:
            plt.figure(figsize=(6,4))
            plt.plot(district_data["Year"], district_data["Rape"], marker='o', label="Rape")
            plt.plot(district_data["Year"], district_data["Theft"], marker='o', label="Theft")
            plt.plot(district_data["Year"], district_data["Property"], marker='o', label="Property")

            plt.title(f"Crime Trend - {district}")
            plt.xlabel("Year")
            plt.ylabel("Cases")
            plt.legend()

            if not os.path.exists("static"):
                os.makedirs("static")

            graph_path = "static/graph.png"
            plt.savefig(graph_path)
            plt.close()

    return render_template(
        "index.html",
        prediction=prediction,
        crime_info=crime_info,
        insight=insight,
        districts=districts,
        years=years,
        graph_path=graph_path
    )

if __name__ == "__main__":
    app.run(debug=True)