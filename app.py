import os
import numpy as np
import pandas as pd
from flask import Flask, request, render_template, redirect, url_for, flash
from tensorflow.keras.models import load_model
import joblib
from datetime import timedelta
import subprocess

MODEL_PATH = "lstm_ndvi_model_60.h5"
SCALER_PATH = "scaler.pkl"

app = Flask(__name__)
app.secret_key = "secret-key"

model = load_model(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

def rolling_mean(series, window_size):
    return series.rolling(window=window_size, min_periods=window_size).mean()

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    if 'file' not in request.files:
        flash("Upload CSV dengan kolom ndvi_mean & period")
        return redirect(url_for('index'))

    f = request.files['file']
    df = pd.read_csv(f)
    df.to_csv("uploaded.csv", index=False)

    window_size = int(request.form.get("window_size", 5))
    look_back = int(request.form.get("look_back", 10))
    forecast_horizon = int(request.form.get("forecast_horizon", 30))

    df['period'] = pd.to_datetime(df['period'])
    df['ndvi_mean_ma'] = rolling_mean(df['ndvi_mean'], window_size)
    data = df['ndvi_mean_ma'].dropna().values.reshape(-1, 1)

    data_scaled = scaler.transform(data)
    x_last = data_scaled[-look_back:, 0].reshape(1, look_back, 1)
    yhat_scaled = model.predict(x_last)

    if yhat_scaled.ndim == 3:
        yhat_scaled = yhat_scaled.reshape(1, -1)

    yhat = scaler.inverse_transform(yhat_scaled.reshape(-1, 1)).reshape(-1)

    last_date = df['period'].iloc[-1]
    future_dates = [last_date + timedelta(days=i) for i in range(1, forecast_horizon+1)]

    results_df = pd.DataFrame({
        "period": future_dates[:len(yhat)],
        "prediction": yhat
    })
    results_df.to_csv("predictions.csv", index=False)

    # Jalankan visualisasi.py agar update grafik HTML
    subprocess.run(["python", "visualisasi.py"])

    return render_template("index.html", results=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
