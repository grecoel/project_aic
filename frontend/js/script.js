// Konfigurasi API
const API_BASE_URL = 'http://localhost:8080'; // Ganti dengan URL production saat deploy

// Variabel global
let map;
let currentMarker;
let districtLayer;
let ndviLayer;
let allDistrictsLayer;
let districtsData = [];
let selectedDistrict = null;

// Inisialisasi peta Leaflet
function initializeMap() {
    // Inisialisasi peta dengan center di Semarang Tengah
    map = L.map('map').setView([-7.0051, 110.4381], 11);

    // Tambahkan tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Event listeners untuk toggle layer NDVI
    document.getElementById('ndviLayerToggle').addEventListener('change', function() {
        if (ndviLayer) {
            if (this.checked) {
                map.addLayer(ndviLayer);
            } else {
                map.removeLayer(ndviLayer);
            }
        }
    });
    
    // Event listener untuk toggle border kecamatan
    document.getElementById('borderLayerToggle').addEventListener('change', function() {
        if (allDistrictsLayer) {
            if (this.checked) {
                map.addLayer(allDistrictsLayer);
            } else {
                map.removeLayer(allDistrictsLayer);
            }
        }
    });
    
    // Event listeners untuk tombol kecamatan akan dibuat secara dinamis
    // di fungsi updateDistrictButtons() dan createFallbackDistrictButtons()
    
    // Tambahkan event listener untuk klik pada peta
    map.on('click', function(e) {
        // Cek apakah mode koordinat aktif
        const coordinateMode = document.querySelector('input[name="analysisMode"][value="coordinate"]').checked;
        
        if (coordinateMode) {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            
            // Update input fields
            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lng;
            
            // Tambahkan marker sementara
            if (currentMarker) {
                map.removeLayer(currentMarker);
            }
            currentMarker = L.marker([lat, lng]).addTo(map);
        } else {
            // Mode kecamatan - reset highlight jika klik area kosong
            if (!e.originalEvent.target.closest('.leaflet-interactive')) {
                resetAllDistrictHighlight();
            }
        }
    });

    // Load semua kecamatan Semarang dan tampilkan bordernya
    loadAllSemarangDistricts();
}

// Fungsi untuk reset highlight semua kecamatan
function resetAllDistrictHighlight() {
    if (!allDistrictsLayer) return;
    
    allDistrictsLayer.eachLayer(layer => {
        if (layer.districtName) {
            layer.setStyle({
                color: '#95a5a6',
                weight: 2,
                opacity: 0.8,
                fillColor: 'transparent',
                fillOpacity: 0
            });
        }
    });
    
    selectedDistrict = null;
    
    // Hapus hasil analisis
    hideResults();
    
    // Hapus layer NDVI
    if (ndviLayer) {
        map.removeLayer(ndviLayer);
    }
}

// Fungsi untuk memuat semua kecamatan Semarang dari API
async function loadAllSemarangDistricts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/get_semarang_districts`);
        const result = await response.json();
        
        if (result.success && result.districts) {
            districtsData = result.districts;
            displayAllDistrictBorders();
            updateDistrictButtons();
        } else {
            console.warn('Gagal memuat data kecamatan, menggunakan data fallback');
            createFallbackDistrictButtons();
        }
    } catch (error) {
        console.error('Error loading districts:', error);
        createFallbackDistrictButtons();
    }
}

// Fungsi untuk menampilkan border semua kecamatan
function displayAllDistrictBorders() {
    // Hapus layer sebelumnya jika ada
    if (allDistrictsLayer) {
        map.removeLayer(allDistrictsLayer);
    }
    
    // Buat layer group untuk semua kecamatan
    allDistrictsLayer = L.layerGroup();
    
    districtsData.forEach(district => {
        if (district.geometry && district.geometry.coordinates) {
            try {
                // Style default untuk border kecamatan
                const defaultStyle = {
                    color: '#95a5a6',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: 'transparent',
                    fillOpacity: 0
                };
                
                // Buat layer untuk setiap kecamatan
                const districtGeoJSON = L.geoJSON(district.geometry, {
                    style: defaultStyle
                });
                
                // Tambahkan event click untuk setiap kecamatan
                districtGeoJSON.on('click', function() {
                    analyzeDistrict(district.name);
                });
                
                // Tambahkan tooltip dengan nama kecamatan
                districtGeoJSON.bindTooltip(district.name, {
                    permanent: false,
                    direction: 'center',
                    className: 'district-tooltip'
                });
                
                // Simpan referensi nama kecamatan
                districtGeoJSON.districtName = district.name;
                
                // Tambahkan ke layer group
                allDistrictsLayer.addLayer(districtGeoJSON);
                
                console.log(`Added clickable border for: ${district.name}`);
            } catch (error) {
                console.error(`Error creating border for ${district.name}:`, error);
            }
        } else {
            console.warn(`No valid geometry for district: ${district.name}`);
        }
    });
    
    // Tambahkan layer group ke peta
    allDistrictsLayer.addTo(map);
    
    console.log(`Menampilkan border untuk ${districtsData.length} kecamatan`);
}

// Fungsi untuk highlight kecamatan yang dipilih
function highlightSelectedDistrict(districtName) {
    if (!allDistrictsLayer) return;
    
    // Reset semua style ke default
    allDistrictsLayer.eachLayer(layer => {
        if (layer.districtName) {
            layer.setStyle({
                color: '#95a5a6',
                weight: 2,
                opacity: 0.8,
                fillColor: 'transparent',
                fillOpacity: 0
            });
        }
    });
    
    // Highlight kecamatan yang dipilih
    allDistrictsLayer.eachLayer(layer => {
        if (layer.districtName === districtName) {
            layer.setStyle({
                color: '#e74c3c',
                weight: 4,
                opacity: 1,
                fillColor: '#e74c3c',
                fillOpacity: 0.1
            });
            layer.bringToFront();
        }
    });
    
    selectedDistrict = districtName;
}

// Fungsi untuk mengupdate tombol kecamatan berdasarkan data dari API
function updateDistrictButtons() {
    const buttonContainer = document.querySelector('.city-buttons');
    if (!buttonContainer) return;
    
    // Hapus tombol yang ada
    buttonContainer.innerHTML = '';
    
    // Buat tombol untuk setiap kecamatan
    districtsData.forEach(district => {
        const button = document.createElement('button');
        button.className = 'btn btn-city';
        button.textContent = district.name;
        button.addEventListener('click', function() {
            analyzeDistrict(district.name);
        });
        buttonContainer.appendChild(button);
    });
}

// Fungsi fallback jika API tidak tersedia
function createFallbackDistrictButtons() {
    const fallbackDistricts = [
        'Semarang Tengah', 'Semarang Utara', 'Semarang Selatan', 'Semarang Barat', 
        'Semarang Timur', 'Candisari', 'Gayamsari', 'Pedurungan', 'Genuk', 
        'Tembalang', 'Gunungpati', 'Mijen', 'Ngaliyan', 'Banyumanik', 'Tugu',
        'Gajahmungkur'
    ];
    
    const buttonContainer = document.querySelector('.city-buttons');
    if (!buttonContainer) return;
    
    buttonContainer.innerHTML = '';
    
    fallbackDistricts.forEach(districtName => {
        const button = document.createElement('button');
        button.className = 'btn btn-city';
        button.textContent = districtName;
        button.addEventListener('click', function() {
            analyzeDistrict(districtName);
        });
        buttonContainer.appendChild(button);
    });
}

// Fungsi untuk mendapatkan warna berdasarkan klasifikasi vegetasi
function getVegetationColor(classification) {
    switch (classification) {
        case 0:
        case 'Vegetasi Rendah':
            return '#e74c3c'; // Merah
        case 1:
        case 'Vegetasi Sedang':
            return '#f39c12'; // Orange
        case 2:
        case 'Vegetasi Tinggi':
            return '#27ae60'; // Hijau
        default:
            return '#95a5a6'; // Abu-abu
    }
}

// Fungsi untuk membuat custom icon berdasarkan klasifikasi
function createVegetationIcon(classification) {
    const color = getVegetationColor(classification);
    
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// Fungsi untuk memanggil API backend
async function callAPI(endpoint, data) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

// Fungsi untuk menganalisis kecamatan dengan border
async function analyzeDistrict(districtName) {
    try {
        // Sembunyikan error dan hasil sebelumnya
        hideError();
        hideResults();

        // Set selected district untuk prediksi NDVI
        selectedDistrict = districtName;

        // Highlight kecamatan yang dipilih
        highlightSelectedDistrict(districtName);

        // Analisis kecamatan dengan API baru
        const result = await callAPI('/api/analyze_district', {
            district_name: districtName
        });

        if (!result.success) {
            throw new Error(result.error || 'Gagal menganalisis kecamatan');
        }

        const data = result.result;

        // Tampilkan data NDVI dengan statistik lengkap
        displayNDVIResults(data.ndvi_data);

        // Tampilkan hasil prediksi
        displayPredictionResults(data);

        // Update peta dengan layer NDVI (tanpa mengubah border yang sudah ada)
        await updateMapWithNDVILayer(data);

        // Otomatis jalankan prediksi NDVI
        console.log('Running automatic NDVI prediction...');
        await runNDVIPrediction(districtName);

        console.log('Analisis kecamatan berhasil:', districtName);

    } catch (error) {
        console.error('Error during district analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis kecamatan');
    }
}

// Fungsi untuk menjalankan prediksi NDVI otomatis
async function runNDVIPrediction(districtName) {
    try {
        console.log(`Auto-running NDVI prediction for ${districtName}`);
        
        // Show prediction section
        document.getElementById('ndviPredictionResults').classList.remove('hidden');
        
        // Get prediction days from select (default 30)
        const predictionDays = parseInt(document.getElementById('predictionDays').value) || 30;
        
        // Call prediction API
        const response = await fetch(`${API_BASE_URL}/api/predict_ndvi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                district_name: districtName,
                prediction_days: predictionDays
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Auto NDVI prediction response:', data);
        
        if (data.success) {
            if (!data.result) {
                throw new Error('Response tidak mengandung data result');
            }
            
            console.log('Auto prediction result:', data.result);
            displayNDVIPredictionResults(data.result);
            
        } else {
            throw new Error(data.error || 'Gagal melakukan prediksi NDVI');
        }
        
    } catch (error) {
        console.error('Error in automatic NDVI prediction:', error);
        // Don't show error to user for auto prediction, just log it
        console.warn('Automatic NDVI prediction failed, but main analysis succeeded');
    }
}

// Fungsi untuk mengupdate peta dengan layer NDVI saja (border sudah ada)
async function updateMapWithNDVILayer(data) {
    try {
        // Hapus layer NDVI sebelumnya jika ada
        if (ndviLayer) {
            map.removeLayer(ndviLayer);
        }
        
        // Hapus marker sebelumnya jika ada
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }

        // Tambahkan layer NDVI jika tersedia
        if (data.ndvi_data.ndvi_tile_url) {
            try {
                const ndviLayerResult = await callAPI('/api/get_ndvi_layer', {
                    district_name: data.district_name
                });
                
                if (ndviLayerResult.success && ndviLayerResult.tile_url) {
                    ndviLayer = L.tileLayer(ndviLayerResult.tile_url, {
                        opacity: 0.7,
                        attribution: 'NDVI Data from Sentinel-2'
                    });
                    
                    // Cek status toggle sebelum menambahkan layer
                    const ndviToggle = document.getElementById('ndviLayerToggle');
                    if (ndviToggle && ndviToggle.checked) {
                        ndviLayer.addTo(map);
                    }
                }
            } catch (error) {
                console.log('NDVI layer tidak tersedia:', error);
            }
        }

        // Zoom ke kecamatan yang dipilih
        const selectedDistrictLayer = findDistrictLayer(data.district_name);
        if (selectedDistrictLayer) {
            map.fitBounds(selectedDistrictLayer.getBounds(), {
                padding: [20, 20]
            });
            
            // Tampilkan popup dengan informasi detail
            const popupContent = createDetailedPopupContent(data);
            selectedDistrictLayer.bindPopup(popupContent).openPopup();
        }
        
    } catch (error) {
        console.error('Error updating map with NDVI layer:', error);
        showError('Error menampilkan layer NDVI');
    }
}

// Fungsi untuk menganalisis seluruh Kota Semarang
async function analyzeSemarangCity() {
    try {
        // Sembunyikan error dan hasil sebelumnya
        hideError();
        hideResults();
        showLoading(true, 'Menganalisis seluruh Kota Semarang...');

        // Reset highlight semua kecamatan
        resetAllDistrictHighlight();

        // Panggil API untuk analisis kota
        const result = await callAPI('/api/analyze_city', {
            city_name: 'Semarang'
        });

        if (!result.success) {
            throw new Error(result.error || 'Gagal menganalisis kota');
        }

        const data = result.result;

        // Tampilkan hasil agregat untuk seluruh kota
        displayCityResults(data);

        // Ambil dan tampilkan layer NDVI untuk seluruh kota
        await updateMapWithCityNDVILayer();

        // Zoom out untuk menampilkan seluruh kota
        map.setView([-7.0051, 110.4381], 10);

        console.log('Analisis kota berhasil:', data);

    } catch (error) {
        console.error('Error during city analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis kota');
    } finally {
        showLoading(false);
    }
}

// Fungsi untuk mengupdate peta dengan layer NDVI seluruh kota
async function updateMapWithCityNDVILayer() {
    try {
        console.log('Getting city NDVI layer...');
        
        // Hapus layer NDVI sebelumnya jika ada
        if (ndviLayer) {
            map.removeLayer(ndviLayer);
        }
        
        // Hapus marker sebelumnya jika ada
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }

        // Panggil API untuk mendapatkan layer NDVI kota
        const layerResult = await callAPI('/api/get_city_ndvi_layer', {
            city_name: 'Semarang'
        });
        
        if (layerResult.success && layerResult.result.tile_url) {
            console.log('Creating city NDVI layer...');
            
            // Buat layer NDVI untuk kota
            ndviLayer = L.tileLayer(layerResult.result.tile_url, {
                opacity: 0.7,
                attribution: 'NDVI Data from Sentinel-2 - Kota Semarang'
            });
            
            // Cek status toggle sebelum menambahkan layer
            const ndviToggle = document.getElementById('ndviLayerToggle');
            if (ndviToggle && ndviToggle.checked) {
                ndviLayer.addTo(map);
                console.log('City NDVI layer added to map');
            }
            
            // Zoom ke bounds kota jika tersedia
            if (layerResult.result.city_bounds) {
                const bounds = layerResult.result.city_bounds;
                const coordinates = bounds.coordinates[0];
                
                // Convert bounds ke format Leaflet
                const leafletBounds = coordinates.map(coord => [coord[1], coord[0]]);
                map.fitBounds(leafletBounds, {
                    padding: [20, 20]
                });
            }
            
        } else {
            console.warn('City NDVI layer tidak tersedia');
        }
        
    } catch (error) {
        console.error('Error getting city NDVI layer:', error);
        // Tidak perlu menampilkan error ke user, karena ini optional
    }
}

// Fungsi untuk mencari layer kecamatan berdasarkan nama
function findDistrictLayer(districtName) {
    if (!allDistrictsLayer) return null;
    
    let foundLayer = null;
    allDistrictsLayer.eachLayer(layer => {
        if (layer.districtName === districtName) {
            foundLayer = layer;
        }
    });
    
    return foundLayer;
}

// Fungsi untuk membuat popup content yang detail
function createDetailedPopupContent(data) {
    return `
        <div style="text-align: center; min-width: 280px; font-family: Arial, sans-serif;">
            <h4 style="margin-bottom: 15px; color: #2c3e50;">
                <i class="fas fa-map-marker-alt"></i> Kecamatan ${data.district_name}
            </h4>
            
            <div style="text-align: left; margin-bottom: 15px;">
                <h5 style="color: #3498db; margin-bottom: 8px;">
                    <i class="fas fa-brain"></i> Klasifikasi AI
                </h5>
                <p style="margin: 5px 0;"><strong>Hasil:</strong> ${data.prediction_label}</p>
                <p style="margin: 5px 0;"><strong>Confidence:</strong> ${Math.round(Math.max(...Object.values(data.confidence)) * 100)}%</p>
            </div>

            <div style="text-align: left; margin-bottom: 15px;">
                <h5 style="color: #27ae60; margin-bottom: 8px;">
                    <i class="fas fa-leaf"></i> Statistik NDVI
                </h5>
                <p style="margin: 3px 0;"><strong>Rata-rata:</strong> ${data.ndvi_data.ndvi_mean.toFixed(3)}</p>
                <p style="margin: 3px 0;"><strong>Minimum:</strong> ${data.ndvi_data.ndvi_min.toFixed(3)}</p>
                <p style="margin: 3px 0;"><strong>Maksimum:</strong> ${data.ndvi_data.ndvi_max.toFixed(3)}</p>
                ${data.ndvi_data.ndvi_std ? `<p style="margin: 3px 0;"><strong>Std Dev:</strong> ${data.ndvi_data.ndvi_std.toFixed(3)}</p>` : ''}
                ${data.ndvi_data.ndvi_p50 ? `<p style="margin: 3px 0;"><strong>Median:</strong> ${data.ndvi_data.ndvi_p50.toFixed(3)}</p>` : ''}
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <small style="color: #7f8c8d;">
                    <i class="fas fa-satellite"></i> Data Sentinel-2<br>
                    ${data.ndvi_data.date_range}
                </small>
            </div>
        </div>
    `;
}

// Fungsi untuk mendapatkan koordinat kecamatan
function getDistrictCoordinates(districtName) {
    const coords = {
        'Semarang Tengah': [-7.0051, 110.4381],
        'Semarang Utara': [-6.9667, 110.4167],
        'Semarang Selatan': [-7.0333, 110.4500],
        'Semarang Barat': [-6.9833, 110.3833],
        'Semarang Timur': [-7.0167, 110.4667],
        'Candisari': [-7.0500, 110.4000],
        'Gayamsari': [-6.9500, 110.4000],
        'Pedurungan': [-7.0667, 110.3833],
        'Genuk': [-7.0833, 110.4167],
        'Tembalang': [-7.1000, 110.3500],
        'Gunungpati': [-7.0000, 110.3500],
        'Mijen': [-6.9333, 110.3500],
        'Ngaliyan': [-6.9167, 110.4333],
        'Banyumanik': [-7.1333, 110.4000],
        'Tugu': [-6.8833, 110.3833],
        'Semarang Kota': [-6.8667, 110.4500]
    };
    return coords[districtName] || null;
}

// Fungsi untuk menganalisis area
async function analyzeArea() {
    try {
        // Dapatkan koordinat dari input
        const latitude = parseFloat(document.getElementById('latitude').value);
        const longitude = parseFloat(document.getElementById('longitude').value);

        // Validasi input
        if (isNaN(latitude) || isNaN(longitude)) {
            showError('Mohon masukkan koordinat yang valid');
            return;
        }

        // Validasi bahwa koordinat berada dalam wilayah Semarang (toleransi lebih luas)
        if (latitude < -7.3 || latitude > -6.7 || longitude < 110.0 || longitude > 110.8) {
            showError('Koordinat berada di luar wilayah Kota Semarang. Silakan pilih lokasi dalam Kota Semarang.');
            return;
        }

        // Sembunyikan error dan hasil sebelumnya
        hideError();
        hideResults();

        // 1. Ambil data NDVI
        const ndviData = await callAPI('/api/get_ndvi', {
            latitude: latitude,
            longitude: longitude
        });

        if (!ndviData.success) {
            throw new Error(ndviData.error || 'Gagal mengambil data NDVI');
        }

        // Tampilkan data NDVI
        displayNDVIResults(ndviData.data);

        // 2. Prediksi vegetasi
        const predictionData = await callAPI('/api/predict', {
            ndvi_mean: ndviData.data.ndvi_mean,
            ndvi_min: ndviData.data.ndvi_min,
            ndvi_max: ndviData.data.ndvi_max,
            latitude: latitude,
            longitude: longitude
        });

        if (!predictionData.success) {
            throw new Error(predictionData.error || 'Gagal melakukan prediksi');
        }

        // Tampilkan hasil prediksi
        displayPredictionResults(predictionData.result);

        // Update peta
        updateMap(latitude, longitude, predictionData.result);

        console.log('Analisis berhasil completed');

    } catch (error) {
        console.error('Error during analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis data');
    }
}

// Fungsi untuk menampilkan hasil NDVI
function displayNDVIResults(data) {
    document.getElementById('ndviMean').textContent = data.ndvi_mean.toFixed(3);
    document.getElementById('ndviMin').textContent = data.ndvi_min.toFixed(3);
    document.getElementById('ndviMax').textContent = data.ndvi_max.toFixed(3);
    document.getElementById('dataDate').textContent = data.date_range;
    
    // Tambahkan statistik tambahan jika tersedia
    if (data.ndvi_std !== undefined) {
        // Tambahkan elemen untuk statistik tambahan jika belum ada
        addAdditionalNDVIStats(data);
    }
    
    document.getElementById('ndviResults').classList.remove('hidden');
}

// Fungsi untuk menambahkan statistik NDVI tambahan
function addAdditionalNDVIStats(data) {
    const dataGrid = document.querySelector('#ndviResults .data-grid');
    
    // Hapus elemen statistik tambahan yang sudah ada
    const existingStats = dataGrid.querySelectorAll('.additional-stat');
    existingStats.forEach(stat => stat.remove());
    
    // Tambahkan statistik baru
    if (data.ndvi_std !== undefined) {
        const stdItem = document.createElement('div');
        stdItem.className = 'data-item additional-stat';
        stdItem.innerHTML = `
            <span class="data-label">Standar Deviasi:</span>
            <span class="data-value">${data.ndvi_std.toFixed(3)}</span>
        `;
        dataGrid.appendChild(stdItem);
    }
    
    if (data.ndvi_p50 !== undefined) {
        const medianItem = document.createElement('div');
        medianItem.className = 'data-item additional-stat';
        medianItem.innerHTML = `
            <span class="data-label">Median (P50):</span>
            <span class="data-value">${data.ndvi_p50.toFixed(3)}</span>
        `;
        dataGrid.appendChild(medianItem);
    }
    
    if (data.ndvi_p25 !== undefined && data.ndvi_p75 !== undefined) {
        const iqrItem = document.createElement('div');
        iqrItem.className = 'data-item additional-stat';
        iqrItem.innerHTML = `
            <span class="data-label">IQR (P25-P75):</span>
            <span class="data-value">${data.ndvi_p25.toFixed(3)} - ${data.ndvi_p75.toFixed(3)}</span>
        `;
        dataGrid.appendChild(iqrItem);
    }
}

// Fungsi untuk menampilkan hasil prediksi
function displayPredictionResults(result) {
    // Tampilkan klasifikasi utama
    document.getElementById('predictionClass').textContent = result.prediction_label;
    
    // Tampilkan confidence bars
    const confidence = result.confidence;
    
    updateConfidenceBar('confidenceLow', 'confidenceLowText', confidence['Vegetasi Rendah']);
    updateConfidenceBar('confidenceMedium', 'confidenceMediumText', confidence['Vegetasi Sedang']);
    updateConfidenceBar('confidenceHigh', 'confidenceHighText', confidence['Vegetasi Tinggi']);
    
    document.getElementById('predictionResults').classList.remove('hidden');
}

// Fungsi untuk update confidence bar
function updateConfidenceBar(barId, textId, value) {
    const percentage = Math.round(value * 100);
    
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    
    if (bar) {
        bar.style.width = `${percentage}%`;
        
        // Ubah warna berdasarkan nilai
        if (percentage > 70) {
            bar.style.background = 'linear-gradient(90deg, #27ae60, #229954)';
        } else if (percentage > 50) {
            bar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #3498db, #2980b9)';
        }
    }
    
    if (text) {
        text.textContent = `${percentage}%`;
    }
}

// Fungsi untuk menampilkan hasil analisis kota
function displayCityResults(data) {
    // Update judul hasil jika elemen ada
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        const resultsTitle = resultsContainer.querySelector('h3');
        if (resultsTitle) {
            resultsTitle.innerHTML = '<i class="fas fa-city"></i> Hasil Analisis Kota Semarang';
        }
        resultsContainer.classList.remove('hidden');
    }
    
    // Tampilkan statistik agregat kota
    displayCityNDVIResults(data.city_ndvi_data);
    
    // Tampilkan distribusi prediksi per kecamatan
    displayCityPredictionResults(data);
    
    // Tampilkan ringkasan kecamatan
    displayDistrictSummary(data.district_analysis);
}

// Fungsi untuk menampilkan hasil NDVI agregat kota
function displayCityNDVIResults(cityNdviData) {
    // Update nilai-nilai NDVI agregat (hanya yang tersedia di HTML)
    const ndviMean = document.getElementById('ndviMean');
    const ndviMin = document.getElementById('ndviMin');
    const ndviMax = document.getElementById('ndviMax');
    
    if (ndviMean) ndviMean.textContent = cityNdviData.ndvi_mean.toFixed(3);
    if (ndviMin) ndviMin.textContent = cityNdviData.ndvi_min.toFixed(3);
    if (ndviMax) ndviMax.textContent = cityNdviData.ndvi_max.toFixed(3);
    
    // Update elemen tambahan jika ada
    const ndviStd = document.getElementById('ndviStd');
    const ndviP25 = document.getElementById('ndviP25');
    const ndviP50 = document.getElementById('ndviP50');
    const ndviP75 = document.getElementById('ndviP75');
    
    if (ndviStd) ndviStd.textContent = cityNdviData.ndvi_std.toFixed(3);
    if (ndviP25) ndviP25.textContent = cityNdviData.ndvi_p25.toFixed(3);
    if (ndviP50) ndviP50.textContent = cityNdviData.ndvi_p50.toFixed(3);
    if (ndviP75) ndviP75.textContent = cityNdviData.ndvi_p75.toFixed(3);
    
    // Update color coding untuk interpretasi
    updateNDVIInterpretation(cityNdviData.ndvi_mean);
    
    document.getElementById('ndviResults').classList.remove('hidden');
}

// Fungsi untuk menampilkan hasil prediksi kota
function displayCityPredictionResults(data) {
    // Hitung distribusi prediksi
    const distribution = data.prediction_distribution;
    
    // Update persentase distribusi
    const totalDistricts = distribution.total_districts;
    const lowVeg = ((distribution.vegetasi_rendah / totalDistricts) * 100).toFixed(1);
    const medVeg = ((distribution.vegetasi_sedang / totalDistricts) * 100).toFixed(1);
    const highVeg = ((distribution.vegetasi_tinggi / totalDistricts) * 100).toFixed(1);
    
    // Update display prediksi untuk seluruh kota
    const predictionClass = document.getElementById('predictionClass');
    if (predictionClass) {
        predictionClass.textContent = data.city_classification;
    }
    
    // Update confidence bars dengan distribusi kecamatan
    updateConfidenceBar('confidenceLow', 'confidenceLowText', distribution.vegetasi_rendah / totalDistricts);
    updateConfidenceBar('confidenceMedium', 'confidenceMediumText', distribution.vegetasi_sedang / totalDistricts);
    updateConfidenceBar('confidenceHigh', 'confidenceHighText', distribution.vegetasi_tinggi / totalDistricts);
    
    const predictionResults = document.getElementById('predictionResults');
    if (predictionResults) {
        predictionResults.classList.remove('hidden');
    }
}

// Fungsi untuk menampilkan ringkasan kecamatan
function displayDistrictSummary(districtAnalysis) {
    let summaryContainer = document.getElementById('districtSummary');
    
    if (!summaryContainer) {
        summaryContainer = createDistrictSummaryContainer();
    }
    
    if (!summaryContainer) {
        console.warn('Cannot create district summary container');
        return;
    }
    
    let summaryHtml = `
        <h4><i class="fas fa-chart-bar"></i> Ringkasan Per Kecamatan</h4>
        <div class="district-grid">
    `;
    
    districtAnalysis.forEach(district => {
        const vegClass = getVegetationClass(district.prediction_class);
        const classColor = getVegetationColor(district.prediction_class);
        
        summaryHtml += `
            <div class="district-card" style="border-left: 4px solid ${classColor};">
                <h5>${district.district_name}</h5>
                <div class="district-stats">
                    <span class="ndvi-value">NDVI: ${district.ndvi_mean.toFixed(3)}</span>
                    <span class="prediction-badge" style="background-color: ${classColor};">${vegClass}</span>
                </div>
            </div>
        `;
    });
    
    summaryHtml += '</div>';
    summaryContainer.innerHTML = summaryHtml;
}

// Helper functions
function createDistrictSummaryContainer() {
    const resultsContainer = document.querySelector('.results-container');
    if (!resultsContainer) {
        console.warn('Results container not found');
        return null;
    }
    
    const container = document.createElement('div');
    container.id = 'districtSummary';
    container.className = 'district-summary';
    
    resultsContainer.appendChild(container);
    
    return container;
}

function getVegetationClass(predictionClass) {
    const classes = ['Vegetasi Rendah', 'Vegetasi Sedang', 'Vegetasi Tinggi'];
    return classes[predictionClass] || 'Unknown';
}

function getVegetationColor(predictionClass) {
    const colors = ['#e74c3c', '#f39c12', '#27ae60'];
    return colors[predictionClass] || '#95a5a6';
}

// Fungsi untuk update interpretasi NDVI dengan color coding
function updateNDVIInterpretation(ndviMean) {
    // Update warna berdasarkan nilai NDVI rata-rata
    const ndviMeanElement = document.getElementById('ndviMean');
    if (ndviMeanElement) {
        if (ndviMean < 0.3) {
            ndviMeanElement.style.color = '#e74c3c'; // Merah untuk vegetasi rendah
            ndviMeanElement.style.fontWeight = 'bold';
        } else if (ndviMean < 0.6) {
            ndviMeanElement.style.color = '#f39c12'; // Orange untuk vegetasi sedang
            ndviMeanElement.style.fontWeight = 'bold';
        } else {
            ndviMeanElement.style.color = '#27ae60'; // Hijau untuk vegetasi tinggi
            ndviMeanElement.style.fontWeight = 'bold';
        }
    }
    
    // Tambahkan interpretasi visual jika ada elemen container
    const interpretationContainer = document.getElementById('ndviInterpretation');
    if (interpretationContainer) {
        let interpretation = '';
        let colorClass = '';
        
        if (ndviMean < 0.3) {
            interpretation = 'Vegetasi Rendah - Area perkotaan padat, sedikit vegetasi';
            colorClass = 'interpretation-low';
        } else if (ndviMean < 0.6) {
            interpretation = 'Vegetasi Sedang - Area campuran perkotaan dan taman';
            colorClass = 'interpretation-medium';
        } else {
            interpretation = 'Vegetasi Tinggi - Area hijau, taman, atau hutan kota';
            colorClass = 'interpretation-high';
        }
        
        interpretationContainer.innerHTML = `
            <div class="ndvi-interpretation ${colorClass}">
                <i class="fas fa-leaf"></i>
                <span>${interpretation}</span>
            </div>
        `;
    }
}

// Fungsi untuk update peta
function updateMap(latitude, longitude, predictionResult) {
    // Hapus marker sebelumnya
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Buat icon berdasarkan klasifikasi
    const icon = createVegetationIcon(predictionResult.prediction_class);
    
    // Tambahkan marker baru
    currentMarker = L.marker([latitude, longitude], { icon: icon }).addTo(map);
    
    // Buat popup content
    const popupContent = `
        <div style="text-align: center; min-width: 200px;">
            <h4>${predictionResult.prediction_label}</h4>
            <p><strong>NDVI Rata-rata:</strong> ${predictionResult.input_data.ndvi_mean.toFixed(3)}</p>
            <p><strong>Koordinat:</strong> ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</p>
            <p><strong>Confidence:</strong> ${Math.round(Math.max(...Object.values(predictionResult.confidence)) * 100)}%</p>
        </div>
    `;
    
    currentMarker.bindPopup(popupContent);
    
    // Center peta ke lokasi
    map.setView([latitude, longitude], 13);
    
    // Buka popup
    currentMarker.openPopup();
}

// Fungsi untuk menampilkan loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Fungsi untuk menampilkan error
function showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').classList.remove('hidden');
}

// Fungsi untuk menyembunyikan error
function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

// Fungsi untuk menyembunyikan hasil
function hideResults() {
    document.getElementById('ndviResults').classList.add('hidden');
    document.getElementById('predictionResults').classList.add('hidden');
}

// Fungsi untuk set koordinat kecamatan
function setCityCoordinates(latitude, longitude, districtName) {
    document.getElementById('latitude').value = latitude;
    document.getElementById('longitude').value = longitude;
    
    // Update peta
    map.setView([latitude, longitude], 13);
    
    // Hapus marker sebelumnya
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    
    // Tambahkan marker baru
    currentMarker = L.marker([latitude, longitude]).addTo(map);
    currentMarker.bindPopup(`<b>Kecamatan ${districtName}</b><br>Kota Semarang<br>Klik "Analisis Area" untuk memulai`);
    
    console.log(`Koordinat diset ke Kecamatan ${districtName}: ${latitude}, ${longitude}`);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi peta
    initializeMap();
    
    // Event listener untuk tombol analisis
    document.getElementById('analyzeBtn').addEventListener('click', analyzeArea);
    
    // Event listener untuk tombol analisis seluruh kota
    document.getElementById('analyzeCityBtn').addEventListener('click', analyzeSemarangCity);
    
    // Event listeners untuk toggle mode analisis
    document.querySelectorAll('input[name="analysisMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const coordinateInputs = document.getElementById('coordinateInputs');
            const analyzeBtn = document.getElementById('analyzeBtn');
            
            if (this.value === 'coordinate') {
                coordinateInputs.style.display = 'block';
                analyzeBtn.style.display = 'inline-flex';
            } else {
                coordinateInputs.style.display = 'none';
                analyzeBtn.style.display = 'none';
            }
        });
    });
    
    // Event listener untuk toggle layer NDVI
    document.getElementById('ndviLayerToggle').addEventListener('change', function() {
        if (ndviLayer) {
            if (this.checked) {
                map.addLayer(ndviLayer);
            } else {
                map.removeLayer(ndviLayer);
            }
        }
    });
    
    // Event listeners untuk tombol kecamatan
    document.querySelectorAll('.btn-city').forEach(button => {
        button.addEventListener('click', function() {
            const districtName = this.textContent;
            
            // Langsung analisis kecamatan dengan border
            analyzeDistrict(districtName);
        });
    });
    
    // Event listener untuk Enter key pada input
    document.getElementById('latitude').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            analyzeArea();
        }
    });
    
    document.getElementById('longitude').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            analyzeArea();
        }
    });
    
    console.log('Dashboard berhasil diinisialisasi');
});

// Fungsi untuk testing API (opsional)
async function testAPI() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        const data = await response.json();
        console.log('API Test Result:', data);
        return true;
    } catch (error) {
        console.error('API tidak dapat diakses:', error);
        showError('Backend API tidak dapat diakses. Pastikan server backend berjalan.');
        return false;
    }
}

// Test API saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(testAPI, 1000); // Test API setelah 1 detik
});

// Fungsi untuk prediksi NDVI
async function predictNDVI() {
    try {
        // Pastikan ada district yang dipilih
        if (!selectedDistrict) {
            showError('Silakan pilih kecamatan terlebih dahulu untuk prediksi NDVI');
            return;
        }
        
        const predictionDays = parseInt(document.getElementById('predictionDays').value);
        const predictBtn = document.getElementById('predictNDVIBtn');
        
        // Disable tombol dan tampilkan loading
        predictBtn.disabled = true;
        predictBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memprediksi...';
        
        // Hide chart dan stats
        document.getElementById('predictionChart').classList.add('hidden');
        document.getElementById('predictionStats').classList.add('hidden');
        
        console.log(`Predicting NDVI for ${selectedDistrict} for ${predictionDays} days`);
        
        const response = await fetch(`${API_BASE_URL}/api/predict_ndvi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                district_name: selectedDistrict,
                prediction_days: predictionDays
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            if (!data.result) {
                throw new Error('Response tidak mengandung data result');
            }
            
            console.log('Prediction result:', data.result);
            displayNDVIPredictionResults(data.result);
            
            // Show prediksi section
            document.getElementById('ndviPredictionResults').classList.remove('hidden');
        } else {
            throw new Error(data.error || 'Gagal melakukan prediksi NDVI');
        }
        
    } catch (error) {
        console.error('Error predicting NDVI:', error);
        showError(`Gagal melakukan prediksi NDVI: ${error.message}`);
    } finally {
        // Enable tombol kembali
        const predictBtn = document.getElementById('predictNDVIBtn');
        predictBtn.disabled = false;
        predictBtn.innerHTML = '<i class="fas fa-chart-line"></i> Prediksi NDVI';
    }
}

// Fungsi untuk menampilkan hasil prediksi NDVI
function displayNDVIPredictionResults(result) {
    try {
        console.log('Displaying NDVI prediction results:', result);
        
        // Show the prediction chart container
        const predictionContainer = document.getElementById('prediction-chart-container');
        if (predictionContainer) {
            predictionContainer.style.display = 'block';
        }
        
        // Validasi struktur data
        if (!result) {
            throw new Error('Data hasil prediksi tidak tersedia');
        }
        
        if (!result.statistics) {
            throw new Error('Data statistik tidak tersedia dalam hasil prediksi');
        }
        
        const stats = result.statistics;
        if (stats.avg_prediction === undefined || stats.min_prediction === undefined || 
            stats.max_prediction === undefined || !stats.trend) {
            throw new Error('Data statistik tidak lengkap');
        }
        
        // Update summary in new container
        updatePredictionSummary(stats);
        
        console.log('Statistics updated successfully');
        
        // Render grafik jika tersedia
        if (result.plot_json) {
            console.log('Plot JSON available, rendering chart...');
            console.log('Plot JSON length:', result.plot_json.length);
            console.log('About to call renderNDVIChart...');
            renderNDVIChart(result.plot_json);
        } else {
            console.warn('Data grafik tidak tersedia dalam result');
            console.log('Available result keys:', Object.keys(result));
            console.log('Result object:', result);
        }
        
        console.log('NDVI prediction results displayed successfully');
        
    } catch (error) {
        console.error('Error displaying NDVI prediction results:', error);
        showError('Gagal menampilkan hasil prediksi: ' + error.message);
    }
}

// Fungsi untuk update summary statistik di container baru
function updatePredictionSummary(stats) {
    try {
        // Update summary values in new container
        const avgEl = document.getElementById('pred-avg-value');
        const minEl = document.getElementById('pred-min-value');
        const maxEl = document.getElementById('pred-max-value');
        const trendEl = document.getElementById('pred-trend-value');
        
        if (avgEl) avgEl.textContent = stats.avg_prediction.toFixed(4);
        if (minEl) minEl.textContent = stats.min_prediction.toFixed(4);
        if (maxEl) maxEl.textContent = stats.max_prediction.toFixed(4);
        
        if (trendEl) {
            const trend = stats.trend;
            trendEl.textContent = trend.charAt(0).toUpperCase() + trend.slice(1);
            
            // Add trend styling
            if (trend === 'meningkat') {
                trendEl.style.color = '#27ae60';
            } else if (trend === 'menurun') {
                trendEl.style.color = '#e74c3c';
            } else {
                trendEl.style.color = '#f39c12';
            }
        }
        
        console.log('Prediction summary updated successfully');
    } catch (error) {
        console.error('Error updating prediction summary:', error);
    }
}

// Fungsi terpisah untuk render chart NDVI
function renderNDVIChart(plotJson) {
    console.log('Starting to render NDVI chart...');
    console.log('Plot JSON received:', plotJson ? 'Yes' : 'No');
    console.log('Plot JSON type:', typeof plotJson);
    
    try {
        // Show the prediction chart container first
        const predictionContainer = document.getElementById('prediction-chart-container');
        console.log('Prediction container element:', predictionContainer);
        if (predictionContainer) {
            predictionContainer.style.display = 'block';
            predictionContainer.classList.remove('hidden');
            console.log('Prediction container shown, display style:', predictionContainer.style.display);
            console.log('Prediction container classes:', predictionContainer.className);
        } else {
            console.error('Prediction container not found!');
            return;
        }
        
        // Cek apakah Plotly tersedia
        if (typeof Plotly === 'undefined') {
            console.error('Plotly tidak tersedia - pastikan script Plotly sudah dimuat');
            throw new Error('Plotly tidak tersedia - pastikan script Plotly sudah dimuat');
        }
        console.log('Plotly is available, version:', Plotly.version);
        
        const chartContainer = document.getElementById('prediction-chart');
        console.log('Chart container element:', chartContainer);
        if (!chartContainer) {
            console.error('Container grafik tidak ditemukan');
            throw new Error('Container grafik tidak ditemukan');
        }
        console.log('Chart container found:', chartContainer);
        
        // Parse data grafik
        let plotData;
        try {
            console.log('Plot JSON type:', typeof plotJson);
            console.log('Plot JSON length:', plotJson ? plotJson.length : 'N/A');
            console.log('Plot JSON first 100 chars:', plotJson ? plotJson.substring(0, 100) : 'N/A');
            
            plotData = JSON.parse(plotJson);
            console.log('NDVI plot data parsed successfully');
            console.log('Plot data structure:', Object.keys(plotData));
            console.log('Plot data.data length:', plotData.data ? plotData.data.length : 'N/A');
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            console.log('Plot JSON that failed to parse:', plotJson);
            console.log('Creating fallback chart...');
            plotData = createFallbackChart();
        }
        
        // Validasi struktur data
        if (!plotData.data || !plotData.layout) {
            console.warn('Invalid plot data structure, creating fallback...');
            plotData = createFallbackChart();
        }
        
        // Configure plot layout
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'resetScale2d'],
            displaylogo: false
        };
        
        console.log('About to call Plotly.newPlot...');
        console.log('Container ID:', 'prediction-chart');
        console.log('Plot data ready:', plotData.data ? 'YES' : 'NO');
        console.log('Plot layout ready:', plotData.layout ? 'YES' : 'NO');
        console.log('Config ready:', config ? 'YES' : 'NO');
        
        // Clear container first
        chartContainer.innerHTML = '';
        console.log('Container cleared');
        
        // Render grafik
        Plotly.newPlot('prediction-chart', plotData.data, plotData.layout, config)
            .then(() => {
                console.log('✅ NDVI chart rendered successfully');
                chartContainer.classList.remove('hidden');
                console.log('Chart container is now visible');
                
                // Force container visibility
                chartContainer.style.display = 'block';
                chartContainer.style.height = 'auto';
                chartContainer.style.minHeight = '400px';
                console.log('Container styles applied');
            })
            .catch((plotError) => {
                console.error('❌ Plotly rendering error:', plotError);
                console.error('Error details:', plotError);
                showError('Gagal menampilkan grafik: ' + plotError.message);
            });
        
    } catch (error) {
        console.error('Error in NDVI chart rendering:', error);
        showError('Grafik tidak dapat ditampilkan: ' + error.message);
    }
}

// ==================== DETEKSI AREA KRITIS ====================

async function detectCriticalAreas() {
    console.log('Starting critical area detection...');
    
    try {
        // Show loading
        showLoading('Menganalisis area kritis dengan AI...');
        
        // Get threshold values with fallback
        const thresholdMinInput = document.getElementById('thresholdMin');
        const thresholdMaxInput = document.getElementById('thresholdMax');
        
        const thresholdMin = thresholdMinInput ? parseFloat(thresholdMinInput.value) : 0.2;
        const thresholdMax = thresholdMaxInput ? parseFloat(thresholdMaxInput.value) : 0.3;
        
        console.log(`Detecting areas with NDVI ${thresholdMin} - ${thresholdMax}`);
        
        const response = await fetch('/api/detect_critical_areas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                threshold_min: thresholdMin,
                threshold_max: thresholdMax
            })
        });
        
        const data = await response.json();
        console.log('Critical area detection response:', data);
        
        if (data.success) {
            displayCriticalAreas(data);
            showCriticalAreasOnMap(data.critical_areas);
        } else {
            throw new Error(data.error || 'Gagal mendeteksi area kritis');
        }
        
    } catch (error) {
        console.error('Error detecting critical areas:', error);
        showError('Gagal mendeteksi area kritis: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayCriticalAreas(data) {
    console.log('Displaying critical areas results...');
    console.log('Data received:', data);
    
    // Show critical areas container
    const criticalContainer = document.getElementById('critical-areas-container');
    console.log('Critical container element:', criticalContainer);
    
    if (criticalContainer) {
        criticalContainer.style.display = 'block';
        criticalContainer.classList.remove('hidden');
        console.log('Critical container shown, display style:', criticalContainer.style.display);
        console.log('Critical container classes:', criticalContainer.className);
        
        // Scroll to container
        criticalContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        console.error('Critical areas container not found!');
        return;
    }
    
    // Update statistics
    updateCriticalAreasStats(data.statistics);
    
    // Display critical areas list
    displayCriticalAreasList(data.critical_areas);
    
    // Display recommendations
    displayRecommendations(data.recommendations);
    
    console.log('Critical areas results displayed successfully');
}

function updateCriticalAreasStats(stats) {
    try {
        // Update statistic values
        const totalEl = document.getElementById('total-analyzed');
        const criticalCountEl = document.getElementById('critical-count');
        const percentageEl = document.getElementById('critical-percentage');
        const avgNdviEl = document.getElementById('avg-ndvi-critical');
        const mostCriticalEl = document.getElementById('most-critical');
        
        if (totalEl) totalEl.textContent = stats.total_districts_analyzed;
        if (criticalCountEl) criticalCountEl.textContent = stats.critical_areas_found;
        if (percentageEl) percentageEl.textContent = stats.percentage_critical.toFixed(1) + '%';
        if (avgNdviEl) avgNdviEl.textContent = stats.avg_ndvi_critical.toFixed(3);
        if (mostCriticalEl) mostCriticalEl.textContent = stats.most_critical_district || 'Tidak ada';
        
        console.log('Critical areas statistics updated');
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

function displayCriticalAreasList(criticalAreas) {
    const listContainer = document.getElementById('critical-areas-list');
    if (!listContainer) return;
    
    if (criticalAreas.length === 0) {
        listContainer.innerHTML = '<div class="no-critical-areas">Tidak ada area kritis yang terdeteksi dalam rentang yang ditentukan.</div>';
        return;
    }
    
    let html = '';
    
    criticalAreas.forEach((area, index) => {
        const severityClass = getSeverityClass(area.severity);
        const riskBadge = getRiskBadge(area.risk_score);
        
        html += `
            <div class="critical-area-item ${severityClass}" onclick="focusOnCriticalArea('${area.district_name}', ${area.coordinates[0]}, ${area.coordinates[1]})">
                <div class="area-header">
                    <h4 class="area-name">${area.district_name}</h4>
                    <div class="badges">
                        <span class="severity-badge ${severityClass}">${area.severity}</span>
                        ${riskBadge}
                    </div>
                </div>
                <div class="area-details">
                    <div class="detail-row">
                        <span class="label">NDVI Rata-rata:</span>
                        <span class="value">${area.avg_ndvi.toFixed(3)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Area Kritis:</span>
                        <span class="value">${area.critical_percentage.toFixed(1)}%</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Risk Score:</span>
                        <span class="value">${area.risk_score.toFixed(0)}/100</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Rentang NDVI:</span>
                        <span class="value">${area.min_ndvi.toFixed(3)} - ${area.max_ndvi.toFixed(3)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    console.log(`Displayed ${criticalAreas.length} critical areas`);
}

function displayRecommendations(recommendations) {
    const generalContainer = document.getElementById('general-recommendations');
    const specificContainer = document.getElementById('specific-recommendations');
    
    if (generalContainer && recommendations.general) {
        let html = '<ul>';
        recommendations.general.forEach(rec => {
            html += `<li>${rec}</li>`;
        });
        html += '</ul>';
        generalContainer.innerHTML = html;
    }
    
    if (specificContainer && recommendations.specific) {
        let html = '<ul>';
        recommendations.specific.forEach(rec => {
            html += `<li>${rec}</li>`;
        });
        html += '</ul>';
        specificContainer.innerHTML = html;
    }
    
    console.log('Recommendations displayed');
}

function getSeverityClass(severity) {
    switch (severity) {
        case 'SANGAT KRITIS': return 'severity-critical';
        case 'KRITIS': return 'severity-high';
        case 'BERPOTENSI KRITIS': return 'severity-medium';
        default: return 'severity-normal';
    }
}

function getRiskBadge(riskScore) {
    if (riskScore >= 80) {
        return '<span class="risk-badge risk-critical">RISIKO TINGGI</span>';
    } else if (riskScore >= 60) {
        return '<span class="risk-badge risk-high">RISIKO SEDANG</span>';
    } else if (riskScore >= 40) {
        return '<span class="risk-badge risk-medium">RISIKO RENDAH</span>';
    } else {
        return '<span class="risk-badge risk-low">MONITORING</span>';
    }
}

function showCriticalAreasOnMap(criticalAreas) {
    console.log('Showing critical areas on map...');
    
    // Clear existing critical area markers
    if (window.criticalAreaMarkers) {
        window.criticalAreaMarkers.forEach(marker => map.removeLayer(marker));
    }
    window.criticalAreaMarkers = [];
    
    // Add markers for critical areas
    criticalAreas.forEach(area => {
        if (area.coordinates) {
            const [lat, lng] = area.coordinates;
            
            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: `critical-area-marker ${getSeverityClass(area.severity)}`,
                    html: `<div class="marker-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span class="district-name">${area.district_name}</span>
                        <span class="ndvi-value">NDVI: ${area.avg_ndvi.toFixed(3)}</span>
                    </div>`,
                    iconSize: [120, 60],
                    iconAnchor: [60, 30]
                })
            });
            
            marker.bindPopup(`
                <div class="critical-popup">
                    <h3>${area.district_name}</h3>
                    <p><strong>Status:</strong> ${area.severity}</p>
                    <p><strong>NDVI:</strong> ${area.avg_ndvi.toFixed(3)}</p>
                    <p><strong>Area Kritis:</strong> ${area.critical_percentage.toFixed(1)}%</p>
                    <p><strong>Risk Score:</strong> ${area.risk_score.toFixed(0)}/100</p>
                </div>
            `);
            
            marker.addTo(map);
            window.criticalAreaMarkers.push(marker);
        }
    });
    
    console.log(`Added ${criticalAreas.length} critical area markers to map`);
}

function focusOnCriticalArea(districtName, lat, lng) {
    console.log(`Focusing on critical area: ${districtName}`);
    
    // Pan map to location
    map.setView([lat, lng], 13);
    
    // Find and open popup for this area
    window.criticalAreaMarkers.forEach(marker => {
        const popup = marker.getPopup();
        if (popup && popup.getContent().includes(districtName)) {
            marker.openPopup();
        }
    });
}

// Event listener untuk tombol prediksi
document.addEventListener('DOMContentLoaded', function() {
    const predictBtn = document.getElementById('predictNDVIBtn');
    if (predictBtn) {
        predictBtn.addEventListener('click', predictNDVI);
    }
    
    // Event listener untuk tombol deteksi area kritis
    const detectBtn = document.getElementById('detectCriticalBtn');
    console.log('Critical detection button found:', detectBtn);
    if (detectBtn) {
        detectBtn.addEventListener('click', function() {
            console.log('Critical areas detection button clicked');
            detectCriticalAreas();
        });
    } else {
        console.error('Critical detection button not found!');
    }
});
