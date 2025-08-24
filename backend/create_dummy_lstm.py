import pickle
import numpy as np
import os

def create_dummy_lstm_components():
    """Buat komponen dummy untuk LSTM jika model asli tidak tersedia"""
    try:
        print("Creating dummy LSTM components...")
        
        # Buat scaler dummy
        from sklearn.preprocessing import MinMaxScaler
        scaler = MinMaxScaler()
        
        # Fit scaler dengan data dummy NDVI (0-1 range)
        dummy_data = np.random.uniform(0.1, 0.9, (1000, 1))
        scaler.fit(dummy_data)
        
        # Save scaler
        scaler_path = "models/lstm_scaler.pkl"
        with open(scaler_path, "wb") as f:
            pickle.dump(scaler, f)
        print(f"Dummy scaler berhasil dibuat di: {scaler_path}")
        
        # Buat file marker untuk model dummy
        model_path = "models/lstm_ndvi_model_60.h5.dummy"
        with open(model_path, "w") as f:
            f.write("Dummy LSTM model marker file")
        print(f"Dummy model marker berhasil dibuat di: {model_path}")
        
        return True
        
    except Exception as e:
        print(f"Error creating dummy components: {e}")
        return False

if __name__ == "__main__":
    create_dummy_lstm_components()
