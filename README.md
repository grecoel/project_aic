<<<<<<< HEAD
# Green Urban Dashboard - Semarang

Platform web interaktif untuk menganalisis data vegetasi di Kota Semarang hingga level kecamatan menggunakan AI dan data satelit Sentinel-2.

## 🎯 Tujuan Proyek

Membuat dashboard yang dapat menganalisis tingkat vegetasi urban di Kota Semarang menggunakan:
- Data satelit Sentinel-2 dari Google Earth Engine
- Model AI Random Forest untuk klasifikasi vegetasi
- Visualisasi interaktif dengan Leaflet.js
- Analisis hingga level kecamatan di Kota Semarang

## 🏗️ Arsitektur Sistem

```
Green Urban Dashboard/
├── backend/                 # Flask API Server
│   ├── app.py              # Main Flask application
│   ├── train_model.py      # Script training model
│   ├── requirements.txt    # Python dependencies
│   ├── app.yaml           # Google App Engine config
│   ├── models/            # Trained ML models
│   └── data/              # Training data
└── frontend/              # Web Dashboard
    ├── index.html         # Main dashboard page
    ├── css/style.css      # Styling
    ├── js/script.js       # JavaScript logic
    └── assets/            # Static assets
```

## 🚀 Cara Menjalankan

### Prerequisites
- Python 3.9+
- pip package manager
- Google Earth Engine account (opsional untuk development)

### Langkah 1: Setup Backend

1. Buka terminal di folder `backend/`
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Training model (opsional - model akan otomatis dibuat):
   ```bash
   python train_model.py
   ```

4. Jalankan Flask server:
   ```bash
   python app.py
   ```

Server akan berjalan di: http://localhost:8080

### Langkah 2: Akses Frontend

1. Buka file `frontend/index.html` di browser
2. Atau gunakan Live Server di VS Code

### Menggunakan Script Otomatis (Windows)

1. **Training model**: Double-click `backend/run_training.bat`
2. **Menjalankan aplikasi**: Double-click `run_app.bat`

## 📊 API Endpoints

### 1. GET `/`
Test endpoint untuk memverifikasi API status

### 2. POST `/api/get_ndvi`
Mengambil data NDVI dari Google Earth Engine
```json
{
  "latitude": -6.2088,
  "longitude": 106.8456
}
```

### 3. POST `/api/predict`
Prediksi klasifikasi vegetasi menggunakan Random Forest
```json
{
  "ndvi_mean": 0.45,
  "ndvi_min": 0.12,
  "ndvi_max": 0.78,
  "latitude": -6.2088,
  "longitude": 106.8456
}
```

### 4. POST `/api/analyze_area`
Kombinasi get_ndvi dan predict dalam satu request

## 🎯 Fitur Dashboard

### 1. Peta Interaktif
- Visualisasi peta menggunakan Leaflet.js
- Marker dengan warna berdasarkan klasifikasi vegetasi
- Popup informasi detail untuk setiap lokasi

### 2. Panel Analisis
- Input koordinat manual atau pilih kota preset
- Tombol analisis untuk memulai proses
- Loading indicator saat processing

### 3. Hasil Analisis
- **Data NDVI**: Mean, Min, Max dari Sentinel-2
- **Prediksi AI**: Klasifikasi vegetasi (Rendah/Sedang/Tinggi)
- **Confidence Score**: Tingkat kepercayaan model

### 4. Kota Preset
- Jakarta, Bandung, Surabaya, Yogyakarta, Bogor
- Quick access untuk analisis cepat

## 🤖 Model AI

### Random Forest Classifier
- **Input Features**: NDVI mean, min, max, latitude, longitude
- **Output Classes**: 
  - 0: Vegetasi Rendah (NDVI < 0.3)
  - 1: Vegetasi Sedang (NDVI 0.3-0.6)
  - 2: Vegetasi Tinggi (NDVI > 0.6)
- **Training Data**: 1000 samples dari 5 kota besar Indonesia

### NDVI (Normalized Difference Vegetation Index)
```
NDVI = (NIR - Red) / (NIR + Red)
```
- Menggunakan band B8 (NIR) dan B4 (Red) dari Sentinel-2
- Range: -1 hingga 1 (semakin tinggi = semakin hijau)

## 🌍 Google Earth Engine Setup

### Development Mode
- Aplikasi menggunakan dummy data jika GEE tidak tersedia
- Cocok untuk testing dan development

### Production Mode
1. Buat Service Account di Google Cloud Console
2. Download JSON key file
3. Update path di `app.py`:
   ```python
   credentials = ee.ServiceAccountCredentials(
       'your-service-account@your-project.iam.gserviceaccount.com',
       'path/to/key.json'
   )
   ```

## 🚀 Deployment

### Google App Engine

1. **Persiapan**:
   ```bash
   gcloud init
   gcloud app create --region=asia-southeast2
   ```

2. **Deploy Backend**:
   ```bash
   cd backend/
   gcloud app deploy
   ```

3. **Deploy Frontend** (Google Cloud Storage):
   ```bash
   gsutil mb gs://your-bucket-name
   gsutil -m cp -r frontend/* gs://your-bucket-name/
   gsutil web set -m index.html gs://your-bucket-name
   ```

### Update API URL
Setelah deploy, update `API_BASE_URL` di `frontend/js/script.js`:
```javascript
const API_BASE_URL = 'https://your-project-id.appspot.com';
```

## 🔧 Kustomisasi

### Menambah Kota Baru
1. Update array `cities_data` di `backend/train_model.py`
2. Tambah tombol di `frontend/index.html`
3. Re-training model

### Mengubah Model
1. Edit fungsi `train_model()` di `backend/train_model.py`
2. Eksperimen dengan algoritma lain (SVM, XGBoost, dll.)
3. Update endpoint `/api/predict` jika perlu

### Styling
- Edit `frontend/css/style.css` untuk mengubah tampilan
- Responsive design sudah included untuk mobile

## 🐛 Troubleshooting

### Error "Model not found"
```bash
cd backend/
python train_model.py
```

### Error "GEE API not initialized"
- Normal untuk development mode
- Akan menggunakan dummy data
- Setup service account untuk production

### Frontend tidak bisa akses backend
- Pastikan Flask server berjalan di port 8080
- Check CORS settings di `app.py`
- Update `API_BASE_URL` di `script.js`

### Error dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 📈 Pengembangan Lanjutan

### Phase 2 Ideas
1. **Time Series Analysis**: Analisis perubahan vegetasi dari waktu ke waktu
2. **Multiple Cities Comparison**: Perbandingan antar kota
3. **Heat Map**: Visualisasi density vegetasi
4. **Export Reports**: PDF/Excel export
5. **User Authentication**: Login system
6. **Real-time Monitoring**: Auto-update data

### Technical Improvements
1. **Caching**: Redis untuk cache API responses
2. **Database**: PostgreSQL untuk menyimpan historical data
3. **Monitoring**: Logging dan error tracking
4. **Testing**: Unit tests dan integration tests
5. **CI/CD**: Automated deployment pipeline

## 👥 Tim & Kontribusi

**Green Urban Dashboard** - AI Innovation Challenge 2025

- **Role**: [Sesuaikan dengan peran masing-masing]
- **Technology Stack**: Python, Flask, JavaScript, Leaflet.js, Google Earth Engine, Random Forest
- **Development Time**: 12 hari

## 📄 Lisensi

Project ini dibuat untuk AI Innovation Challenge 2025 dengan tema "Smart City and Urban Living".

---

*Dashboard ini menggunakan data satelit Sentinel-2 dari Copernicus Programme dan Google Earth Engine untuk analisis vegetasi urban di Indonesia.*
=======
# project_aic
>>>>>>> c0a5a75e9d0138ab7caa82175b7c1b998150fef1
