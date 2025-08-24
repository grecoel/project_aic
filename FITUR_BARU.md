# Green Urban Dashboard - Semarang: Fitur Baru

## Fitur Utama yang Ditambahkan

### 1. **Tampilan Border Wilayah Kecamatan**
- Aplikasi sekarang menampilkan **bentuk sebenarnya** dari wilayah kecamatan, bukan hanya pin point
- Border wilayah ditampilkan dengan garis tebal berwarna gelap untuk visualisasi yang jelas
- Data geometri diambil dari asset GCP `indonesia_kecamatan` di project `projectaic-468717`

### 2. **Layer NDVI Persebaran**
- **Layer NDVI interaktif** yang menampilkan persebaran nilai NDVI di seluruh wilayah kecamatan
- Tidak hanya rata-rata, tetapi **seluruh piksel NDVI** dalam area tersebut
- Color scale gradien dari merah (NDVI rendah) hingga biru (NDVI tinggi)
- Toggle on/off untuk layer NDVI

### 3. **Statistik NDVI Lengkap**
- **Mean, Min, Max** (seperti sebelumnya)
- **Standard Deviation** - variabilitas vegetasi dalam wilayah
- **Median (P50)** - nilai tengah yang lebih robust
- **Interquartile Range (P25-P75)** - distribusi kuartil

### 4. **Mode Analisis Dual**
- **Mode Kecamatan**: Analisis langsung dengan memilih kecamatan (default)
- **Mode Koordinat**: Input manual latitude/longitude untuk area spesifik

## API Endpoints Baru

### `/api/analyze_district`
```json
POST /api/analyze_district
{
    "district_name": "Semarang Tengah"
}

Response:
{
    "success": true,
    "result": {
        "ndvi_data": {
            "ndvi_mean": 0.456,
            "ndvi_min": -0.123,
            "ndvi_max": 0.789,
            "ndvi_std": 0.234,
            "ndvi_p25": 0.345,
            "ndvi_p50": 0.456,
            "ndvi_p75": 0.567,
            "geometry": {...},
            "ndvi_tile_url": "https://..."
        },
        "prediction_class": 1,
        "prediction_label": "Vegetasi Sedang",
        "confidence": {...}
    }
}
```

### `/api/get_ndvi_layer`
```json
POST /api/get_ndvi_layer
{
    "district_name": "Semarang Tengah"
}

Response:
{
    "success": true,
    "tile_url": "https://earthengine.googleapis.com/...",
    "map_id": "...",
    "token": "..."
}
```

## Cara Penggunaan

### 1. **Analisis Kecamatan (Rekomendasi)**
1. Pilih "Mode Kecamatan" (default)
2. Klik salah satu tombol kecamatan (16 pilihan)
3. Lihat:
   - **Border wilayah** kecamatan tergambar di peta
   - **Layer NDVI** menampilkan persebaran vegetasi
   - **Statistik lengkap** di panel kanan
   - **Popup informatif** saat mengklik area

### 2. **Analisis Koordinat Manual**
1. Pilih "Mode Koordinat"
2. Input latitude/longitude dalam wilayah Semarang
3. Klik "Analisis Koordinat"

### 3. **Kontrol Layer**
- **Checkbox "Tampilkan Layer NDVI"**: Toggle on/off layer NDVI
- **Legend NDVI**: Color scale menunjukkan range nilai NDVI

## Teknologi yang Digunakan

### Backend Enhancement
- **Google Earth Engine (GEE)**: 
  - Asset `projects/projectaic-468717/assets/indonesia_kecamatan`
  - Sentinel-2 imagery dengan cloud filtering
  - NDVI calculation dengan band B8 (NIR) dan B4 (Red)
  - Tile generation untuk web mapping

### Frontend Enhancement
- **Leaflet.js**: 
  - GeoJSON layer untuk border
  - Tile layer untuk NDVI visualization
  - Layer control dan toggle
- **Advanced Popup**: Detail statistik dan visualisasi

### Data Processing
- **Reduced computation**: 
  - Mean, MinMax, StdDev, Percentiles (25, 50, 75)
  - Scale: 10m resolution
  - Geometry simplification untuk performance

## Benefits

1. **Visual Intuitive**: User dapat melihat bentuk sebenarnya wilayah yang dianalisis
2. **Detail Spatial**: Persebaran NDVI dalam wilayah, bukan hanya rata-rata
3. **Statistik Komprehensif**: Analisis yang lebih mendalam dengan berbagai metrik
4. **User Experience**: Toggle layer, mode dual, popup informatif
5. **Performance**: Geometry simplification dan tile-based rendering

## Color Scale NDVI

| Range | Color | Interpretation |
|-------|--------|----------------|
| -0.2 to -0.1 | Merah | Air, bangunan, tanah kosong |
| -0.1 to 0.1 | Orange | Tanah kering, vegetasi mati |
| 0.1 to 0.3 | Kuning | Vegetasi sparse, rumput kering |
| 0.3 to 0.5 | Hijau muda | Vegetasi sedang, rumput hijau |
| 0.5 to 0.7 | Hijau | Vegetasi sehat, perkebunan |
| 0.7 to 0.8 | Hijau tua | Hutan, vegetasi sangat sehat |

---

**Note**: Aplikasi ini fokus pada 16 kecamatan di Kota Semarang dengan total coverage 373.70 km².
