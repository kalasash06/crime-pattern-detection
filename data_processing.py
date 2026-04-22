import pandas as pd

# Load datasets
rape = pd.read_csv("data/20_Victims_of_rape.csv")
theft = pd.read_csv("data/30_Auto_theft.csv")
property_crime = pd.read_csv("data/10_Property_stolen_and_recovered.csv")

# Clean column names
rape.columns = rape.columns.str.strip()
theft.columns = theft.columns.str.strip()
property_crime.columns = property_crime.columns.str.strip()

# --- PROCESS RAPE ---
rape = rape.rename(columns={
    "Area_Name": "District",
    "Victims_of_Rape_Total": "Rape"
})
rape = rape[["District", "Year", "Rape"]]

# --- PROCESS THEFT ---
theft = theft.rename(columns={
    "Area_Name": "District",
    "Auto_Theft_Stolen": "Theft"
})
theft = theft[["District", "Year", "Theft"]]

# --- PROCESS PROPERTY ---
property_crime = property_crime.rename(columns={
    "Area_Name": "District",
    "Cases_Property_Stolen": "Property"
})
property_crime = property_crime[["District", "Year", "Property"]]

# Merge datasets
df = rape.merge(theft, on=["District", "Year"], how="outer")
df = df.merge(property_crime, on=["District", "Year"], how="outer")

# Fill missing values
df = df.fillna(0)

# Save final dataset
df.to_csv("data/crime_data.csv", index=False)

print("✅ FINAL DATA CREATED SUCCESSFULLY!")