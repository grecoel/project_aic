import pandas as pd
import plotly.graph_objects as go

# Baca data historis + prediksi
hist_df = pd.read_csv("uploaded.csv", parse_dates=["period"])
pred_df = pd.read_csv("predictions.csv", parse_dates=["period"])

# Pastikan urut berdasarkan tanggal
hist_df = hist_df.sort_values("period")
pred_df = pred_df.sort_values("period")

# Ambil 30 hari terakhir dari data historis
last_date = hist_df["period"].max()
last_30_days = last_date - pd.Timedelta(days=30)
hist_last30 = hist_df[hist_df["period"] >= last_30_days]

# Ambil titik terakhir historis
last_hist_date = hist_last30["period"].iloc[-1]
last_hist_value = hist_last30["ndvi_mean"].iloc[-1]

# Sisipkan titik terakhir historis ke awal prediksi
pred_df = pd.concat([
    pd.DataFrame({"period": [last_hist_date], "prediction": [last_hist_value]}),
    pred_df
], ignore_index=True)

# Buat grafik
fig = go.Figure()

# Data historis (30 hari terakhir)
fig.add_trace(go.Scatter(
    x=hist_last30["period"],
    y=hist_last30["ndvi_mean"],
    mode="lines+markers",
    name="Historical NDVI (last 30 days)",
    line=dict(color="blue")
))

# Data prediksi (disambung ke historis)
fig.add_trace(go.Scatter(
    x=pred_df["period"],
    y=pred_df["prediction"],
    mode="lines+markers",
    name="Future Predictions",
    line=dict(color="orange", dash="dash")
))

# Layout
fig.update_layout(
    title="NDVI Time Series: Last 30 Days + Forecast",
    xaxis_title="Tanggal",
    yaxis_title="NDVI Mean",
    legend=dict(x=0, y=1, traceorder="normal"),
    template="plotly_white"
)

# Simpan ke template HTML
fig.write_html("templates/plot.html", full_html=False, include_plotlyjs="cdn")
