"""
Script untuk melatih model Random Forest secara terpisah
Jalankan script ini untuk melatih model sebelum deployment
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

def create_enhanced_training_data():
    """Membuat data training yang lebih realistis"""
    np.random.seed(42)
    
    # Data untuk berbagai kota di Indonesia
    cities_data = {
        'Jakarta': {'lat_center': -6.2, 'lon_center': 106.8, 'urban_density': 'high'},
        'Bandung': {'lat_center': -6.9, 'lon_center': 107.6, 'urban_density': 'medium'},
        'Surabaya': {'lat_center': -7.3, 'lon_center': 112.7, 'urban_density': 'high'},
        'Yogyakarta': {'lat_center': -7.8, 'lon_center': 110.4, 'urban_density': 'medium'},
        'Bogor': {'lat_center': -6.6, 'lon_center': 106.8, 'urban_density': 'low'}
    }
    
    n_samples_per_city = 200
    all_data = []
    
    for city, info in cities_data.items():
        for _ in range(n_samples_per_city):
            # Variasi koordinat di sekitar pusat kota
            lat = np.random.normal(info['lat_center'], 0.1)
            lon = np.random.normal(info['lon_center'], 0.1)
            
            # NDVI berdasarkan kepadatan urban
            if info['urban_density'] == 'high':
                ndvi_base = np.random.uniform(0.1, 0.4)  # Urban padat, vegetasi rendah
            elif info['urban_density'] == 'medium':
                ndvi_base = np.random.uniform(0.3, 0.6)  # Urban sedang
            else:
                ndvi_base = np.random.uniform(0.5, 0.8)  # Area suburban/rural
            
            # Tambahkan noise
            ndvi_mean = np.clip(ndvi_base + np.random.normal(0, 0.1), 0, 1)
            ndvi_min = np.clip(ndvi_mean - np.random.uniform(0.1, 0.3), 0, 1)
            ndvi_max = np.clip(ndvi_mean + np.random.uniform(0.1, 0.3), 0, 1)
            
            # Klasifikasi berdasarkan NDVI
            if ndvi_mean < 0.3:
                vegetation_class = 0  # Rendah
            elif ndvi_mean < 0.6:
                vegetation_class = 1  # Sedang
            else:
                vegetation_class = 2  # Tinggi
            
            all_data.append({
                'city': city,
                'latitude': lat,
                'longitude': lon,
                'ndvi_mean': ndvi_mean,
                'ndvi_min': ndvi_min,
                'ndvi_max': ndvi_max,
                'urban_density': info['urban_density'],
                'vegetation_class': vegetation_class
            })
    
    return pd.DataFrame(all_data)

def train_model():
    """Melatih model Random Forest"""
    print("Membuat data training...")
    df = create_enhanced_training_data()
    
    print(f"Total samples: {len(df)}")
    print(f"Distribusi kelas:")
    print(df['vegetation_class'].value_counts())
    
    # Siapkan fitur
    features = ['ndvi_mean', 'ndvi_min', 'ndvi_max', 'latitude', 'longitude']
    X = df[features]
    y = df['vegetation_class']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("Melatih model Random Forest...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    # Evaluasi
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\nAkurasi model: {accuracy:.3f}")
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, 
                              target_names=['Rendah', 'Sedang', 'Tinggi']))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': features,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print(f"\nFeature Importance:")
    print(feature_importance)
    
    # Simpan model
    os.makedirs('models', exist_ok=True)
    model_path = 'models/rf_model.pkl'
    
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"\nModel disimpan di: {model_path}")
    
    # Simpan juga data training untuk referensi
    df.to_csv('data/training_data.csv', index=False)
    print(f"Data training disimpan di: data/training_data.csv")
    
    return model

if __name__ == "__main__":
    # Pastikan folder ada
    os.makedirs('models', exist_ok=True)
    os.makedirs('data', exist_ok=True)
    
    # Latih model
    trained_model = train_model()
    
    print("\nModel training selesai!")
