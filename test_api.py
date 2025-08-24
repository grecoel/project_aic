"""
Script untuk testing aplikasi Green Urban Dashboard
Menguji semua endpoint API dan fungsionalitas dasar
"""

import requests
import json
import time

# Konfigurasi
API_BASE_URL = 'http://localhost:8080'
TEST_COORDINATES = [
    {'lat': -6.2088, 'lon': 106.8456, 'city': 'Jakarta'},
    {'lat': -6.9175, 'lon': 107.6191, 'city': 'Bandung'},
    {'lat': -7.2575, 'lon': 112.7521, 'city': 'Surabaya'}
]

def test_api_connection():
    """Test koneksi ke API"""
    print("🔍 Testing API connection...")
    try:
        response = requests.get(f"{API_BASE_URL}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API connected successfully")
            print(f"   Message: {data.get('message', 'N/A')}")
            print(f"   Status: {data.get('status', 'N/A')}")
            return True
        else:
            print(f"❌ API connection failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API connection error: {e}")
        return False

def test_ndvi_endpoint():
    """Test endpoint /api/get_ndvi"""
    print("\n🌍 Testing NDVI endpoint...")
    
    test_data = {
        'latitude': -6.2088,
        'longitude': 106.8456
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/get_ndvi",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                result = data['data']
                print(f"✅ NDVI endpoint working")
                print(f"   NDVI Mean: {result.get('ndvi_mean', 'N/A')}")
                print(f"   NDVI Min: {result.get('ndvi_min', 'N/A')}")
                print(f"   NDVI Max: {result.get('ndvi_max', 'N/A')}")
                print(f"   Date Range: {result.get('date_range', 'N/A')}")
                return result
            else:
                print(f"❌ NDVI endpoint error: {data.get('error', 'Unknown error')}")
                return None
        else:
            print(f"❌ NDVI endpoint failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ NDVI endpoint error: {e}")
        return None

def test_predict_endpoint(ndvi_data):
    """Test endpoint /api/predict"""
    print("\n🤖 Testing Prediction endpoint...")
    
    if not ndvi_data:
        print("❌ No NDVI data to test prediction")
        return None
    
    test_data = {
        'ndvi_mean': ndvi_data['ndvi_mean'],
        'ndvi_min': ndvi_data['ndvi_min'],
        'ndvi_max': ndvi_data['ndvi_max'],
        'latitude': ndvi_data['latitude'],
        'longitude': ndvi_data['longitude']
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/predict",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                result = data['result']
                print(f"✅ Prediction endpoint working")
                print(f"   Classification: {result.get('prediction_label', 'N/A')}")
                print(f"   Class ID: {result.get('prediction_class', 'N/A')}")
                
                confidence = result.get('confidence', {})
                print(f"   Confidence Scores:")
                for class_name, score in confidence.items():
                    print(f"     {class_name}: {score:.3f} ({score*100:.1f}%)")
                
                return result
            else:
                print(f"❌ Prediction endpoint error: {data.get('error', 'Unknown error')}")
                return None
        else:
            print(f"❌ Prediction endpoint failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Prediction endpoint error: {e}")
        return None

def test_analyze_endpoint():
    """Test endpoint /api/analyze_area"""
    print("\n📊 Testing Analyze Area endpoint...")
    
    test_data = {
        'latitude': -6.2088,
        'longitude': 106.8456
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/analyze_area",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                result = data['result']
                print(f"✅ Analyze endpoint working")
                
                # NDVI data
                ndvi_data = result.get('ndvi_data', {})
                print(f"   NDVI Mean: {ndvi_data.get('ndvi_mean', 'N/A')}")
                
                # Prediction data
                prediction = result.get('prediction', {})
                print(f"   Classification: {prediction.get('prediction_label', 'N/A')}")
                
                return result
            else:
                print(f"❌ Analyze endpoint error: {data.get('error', 'Unknown error')}")
                return None
        else:
            print(f"❌ Analyze endpoint failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Analyze endpoint error: {e}")
        return None

def test_multiple_cities():
    """Test multiple cities"""
    print("\n🏙️ Testing multiple cities...")
    
    results = []
    for coord in TEST_COORDINATES:
        print(f"\n  Testing {coord['city']}...")
        
        test_data = {
            'latitude': coord['lat'],
            'longitude': coord['lon']
        }
        
        try:
            # Test NDVI
            response = requests.post(
                f"{API_BASE_URL}/api/get_ndvi",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    ndvi_result = data['data']
                    
                    # Test Prediction
                    predict_data = {
                        'ndvi_mean': ndvi_result['ndvi_mean'],
                        'ndvi_min': ndvi_result['ndvi_min'],
                        'ndvi_max': ndvi_result['ndvi_max'],
                        'latitude': coord['lat'],
                        'longitude': coord['lon']
                    }
                    
                    pred_response = requests.post(
                        f"{API_BASE_URL}/api/predict",
                        json=predict_data,
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if pred_response.status_code == 200:
                        pred_data = pred_response.json()
                        if pred_data.get('success'):
                            pred_result = pred_data['result']
                            
                            city_result = {
                                'city': coord['city'],
                                'ndvi_mean': ndvi_result['ndvi_mean'],
                                'classification': pred_result['prediction_label'],
                                'confidence': max(pred_result['confidence'].values())
                            }
                            results.append(city_result)
                            
                            print(f"    ✅ {coord['city']}: {pred_result['prediction_label']} "
                                  f"(NDVI: {ndvi_result['ndvi_mean']:.3f})")
                        else:
                            print(f"    ❌ {coord['city']}: Prediction failed")
                    else:
                        print(f"    ❌ {coord['city']}: Prediction request failed")
                else:
                    print(f"    ❌ {coord['city']}: NDVI failed")
            else:
                print(f"    ❌ {coord['city']}: NDVI request failed")
                
        except Exception as e:
            print(f"    ❌ {coord['city']}: Error - {e}")
        
        # Delay between requests
        time.sleep(1)
    
    return results

def run_all_tests():
    """Menjalankan semua test"""
    print("🚀 Starting Green Urban Dashboard API Tests")
    print("=" * 50)
    
    # Test 1: API Connection
    if not test_api_connection():
        print("\n❌ API connection failed. Make sure Flask server is running.")
        print("   Run: python backend/app.py")
        return False
    
    # Test 2: NDVI Endpoint
    ndvi_result = test_ndvi_endpoint()
    
    # Test 3: Prediction Endpoint
    prediction_result = test_predict_endpoint(ndvi_result)
    
    # Test 4: Analyze Endpoint
    analyze_result = test_analyze_endpoint()
    
    # Test 5: Multiple Cities
    cities_results = test_multiple_cities()
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    
    if ndvi_result and prediction_result and analyze_result:
        print("✅ All core endpoints working!")
        
        if cities_results:
            print(f"✅ Tested {len(cities_results)} cities successfully")
            print("\n🏙️ City Results:")
            for result in cities_results:
                print(f"   {result['city']}: {result['classification']} "
                      f"(NDVI: {result['ndvi_mean']:.3f}, "
                      f"Confidence: {result['confidence']:.1%})")
        
        print("\n🎉 Dashboard ready for use!")
        print("   Backend: http://localhost:8080")
        print("   Frontend: Open frontend/index.html in browser")
        
        return True
    else:
        print("❌ Some tests failed. Check the errors above.")
        return False

if __name__ == "__main__":
    run_all_tests()
