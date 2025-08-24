import urllib.request
import os

def download_lstm_model():
    """Download LSTM model dari GitHub repository"""
    model_url = "https://github.com/grecoel/project_aic/raw/main/lstm_ndvi_model_60.h5"
    model_path = "models/lstm_ndvi_model_60.h5"
    
    try:
        print("Downloading LSTM model...")
        urllib.request.urlretrieve(model_url, model_path)
        print(f"Model berhasil didownload ke: {model_path}")
        
        # Cek ukuran file
        size = os.path.getsize(model_path)
        print(f"Ukuran file: {size} bytes ({size/1024/1024:.2f} MB)")
        
    except Exception as e:
        print(f"Error downloading model: {e}")
        print("Jika model tidak tersedia di repository, kita akan menggunakan model dummy")
        
        # Buat model dummy untuk testing
        create_dummy_model()

def create_dummy_model():
    """Buat model dummy untuk testing jika model asli tidak tersedia"""
    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense
        import pickle
        import numpy as np
        
        print("Creating dummy LSTM model...")
        
        # Buat model LSTM sederhana
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=(60, 1)),
            LSTM(50, return_sequences=False),
            Dense(25),
            Dense(1)
        ])
        
        model.compile(optimizer='adam', loss='mean_squared_error')
        
        # Generate dummy training data
        X_dummy = np.random.random((100, 60, 1))
        y_dummy = np.random.random((100, 1))
        
        # Train model dengan data dummy
        model.fit(X_dummy, y_dummy, epochs=1, verbose=0)
        
        # Save model
        model.save("models/lstm_ndvi_model_60.h5")
        print("Dummy LSTM model berhasil dibuat")
        
        # Buat scaler dummy
        from sklearn.preprocessing import MinMaxScaler
        scaler = MinMaxScaler()
        scaler.fit(np.random.random((100, 1)))
        
        with open("models/lstm_scaler.pkl", "wb") as f:
            pickle.dump(scaler, f)
        print("Dummy scaler berhasil dibuat")
        
    except Exception as e:
        print(f"Error creating dummy model: {e}")

if __name__ == "__main__":
    download_lstm_model()
