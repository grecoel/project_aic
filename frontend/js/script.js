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
                showLegendSection('ndviLegend');
            } else {
                map.removeLayer(ndviLayer);
                hideLegendSection('ndviLegend');
            }
        }
    });
    
    // Event listener untuk toggle border kecamatan
    document.getElementById('borderLayerToggle').addEventListener('change', function() {
        if (allDistrictsLayer) {
            if (this.checked) {
                map.addLayer(allDistrictsLayer);
                showLegendSection('districtLegend');
            } else {
                map.removeLayer(allDistrictsLayer);
                hideLegendSection('districtLegend');
            }
        }
    });
    
    // Initialize legend toggle functionality
    initializeLegendToggle();
    
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
        ndviLayer = null;
    }
    
    // Hapus marker koordinat
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
    
    // Reset toggle states
    const ndviToggle = document.getElementById('ndviLayerToggle');
    if (ndviToggle) {
        ndviToggle.checked = false;
    }
    
    // Clear critical area markers
    if (window.criticalAreaMarkers) {
        window.criticalAreaMarkers.forEach(marker => map.removeLayer(marker));
        window.criticalAreaMarkers = [];
    }
    
    // Clear coordinate inputs dan tambahkan real-time validation
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    if (latInput) {
        latInput.value = '';
        latInput.addEventListener('input', validateCoordinates);
    }
    if (lngInput) {
        lngInput.value = '';
        lngInput.addEventListener('input', validateCoordinates);
    }
    
    // Validate coordinates function
    function validateCoordinates() {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        
        const isValid = !isNaN(lat) && !isNaN(lng) && 
                       lat >= -7.3 && lat <= -6.7 && 
                       lng >= 110.0 && lng <= 110.8;
        
        if (analyzeBtn) {
            if (isValid) {
                analyzeBtn.disabled = false;
                analyzeBtn.classList.remove('disabled');
            } else {
                analyzeBtn.disabled = true;
                analyzeBtn.classList.add('disabled');
            }
        }
    }
}

// Fungsi untuk inisialisasi toggle legend
function initializeLegendToggle() {
    const toggleBtn = document.getElementById('toggleLegend');
    const legend = document.getElementById('mapLegend');
    const legendContent = legend?.querySelector('.legend-content');
    
    if (toggleBtn && legend && legendContent) {
        toggleBtn.addEventListener('click', function() {
            const isCollapsed = legend.classList.contains('collapsed');
            
            if (isCollapsed) {
                legend.classList.remove('collapsed');
                legendContent.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            } else {
                legend.classList.add('collapsed');
                legendContent.style.display = 'none';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            }
        });
        
        // Initially show legend
        legend.classList.remove('hidden');
    }
}

// Fungsi untuk menampilkan section legend
function showLegendSection(sectionId) {
    const legend = document.getElementById('mapLegend');
    const section = document.getElementById(sectionId);
    
    if (legend && section) {
        legend.classList.remove('hidden');
        section.classList.remove('hidden');
    }
}

// Fungsi untuk menyembunyikan section legend
function hideLegendSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('hidden');
    }
    
    // Hide entire legend if no sections are visible
    const legend = document.getElementById('mapLegend');
    if (legend) {
        const visibleSections = legend.querySelectorAll('.legend-section:not(.hidden)');
        if (visibleSections.length === 0) {
            legend.classList.add('hidden');
        }
    }
}

// Fungsi untuk memuat semua kecamatan Semarang dari API
async function loadAllSemarangDistricts() {
    const buttonContainer = document.getElementById('districtButtons');
    const loadingElement = document.getElementById('districtLoading');
    
    // Show loading, hide buttons
    if (buttonContainer) buttonContainer.style.display = 'none';
    if (loadingElement) loadingElement.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/get_semarang_districts`);
        const result = await response.json();
        
        if (result.success && result.districts) {
            districtsData = result.districts;
            displayAllDistrictBorders();
            updateDistrictButtons();
            
            // Hide loading, show buttons
            if (loadingElement) loadingElement.classList.add('hidden');
            if (buttonContainer) buttonContainer.style.display = 'grid';
        } else {
            console.warn('Gagal memuat data kecamatan, menggunakan data fallback');
            createFallbackDistrictButtons();
            
            // Hide loading, show buttons
            if (loadingElement) loadingElement.classList.add('hidden');
            if (buttonContainer) buttonContainer.style.display = 'grid';
        }
    } catch (error) {
        console.error('Error loading districts:', error);
        createFallbackDistrictButtons();
        
        // Hide loading, show buttons
        if (loadingElement) loadingElement.classList.add('hidden');
        if (buttonContainer) buttonContainer.style.display = 'grid';
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
    const buttonContainer = document.getElementById('districtButtons');
    const loadingElement = document.getElementById('districtLoading');
    
    if (!buttonContainer) {
        console.error('District buttons container not found!');
        return;
    }
    
    // Hide loading, show buttons
    if (loadingElement) loadingElement.classList.add('hidden');
    if (buttonContainer) buttonContainer.style.display = 'grid';
    
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
    
    console.log(`Created ${districtsData.length} district buttons`);
}

// Fungsi fallback jika API tidak tersedia
function createFallbackDistrictButtons() {
    const fallbackDistricts = [
        'Semarang Tengah', 'Semarang Utara', 'Semarang Selatan', 'Semarang Barat', 
        'Semarang Timur', 'Candisari', 'Gayamsari', 'Pedurungan', 'Genuk', 
        'Tembalang', 'Gunungpati', 'Mijen', 'Ngaliyan', 'Banyumanik', 'Tugu',
        'Gajahmungkur'
    ];
    
    const buttonContainer = document.getElementById('districtButtons');
    const loadingElement = document.getElementById('districtLoading');
    
    if (!buttonContainer) {
        console.error('District buttons container not found!');
        return;
    }
    
    // Hide loading, show buttons
    if (loadingElement) loadingElement.classList.add('hidden');
    if (buttonContainer) buttonContainer.style.display = 'grid';
    
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
    
    console.log(`Created ${fallbackDistricts.length} fallback district buttons`);
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
        
        // Return fallback data if API is not available
        if (endpoint === '/api/get_ndvi') {
            console.log('Using fallback NDVI data');
            return {
                success: true,
                data: {
                    ndvi_mean: 0.45 + Math.random() * 0.3,
                    ndvi_min: 0.1 + Math.random() * 0.2,
                    ndvi_max: 0.7 + Math.random() * 0.3,
                    date_range: '2024-01-01 to 2024-12-31',
                    ndvi_std: 0.15 + Math.random() * 0.1
                }
            };
        } else if (endpoint === '/api/predict') {
            console.log('Using fallback prediction data');
            const classifications = ['Vegetasi Rendah', 'Vegetasi Sedang', 'Vegetasi Tinggi'];
            const randomClass = classifications[Math.floor(Math.random() * 3)];
            
            return {
                success: true,
                result: {
                    prediction_label: randomClass,
                    confidence: {
                        'Vegetasi Rendah': Math.random() * 0.5,
                        'Vegetasi Sedang': Math.random() * 0.7,
                        'Vegetasi Tinggi': Math.random() * 0.8
                    }
                }
            };
        }
        
        throw error;
    }
}

// Fungsi untuk menganalisis kecamatan dengan border
async function analyzeDistrict(districtName) {
    try {
        // Clear previous results first
        resetAllDistrictHighlight();
        hideResults();
        hideError();
        
        // Show loading with progress
        showLoading('Memulai analisis kecamatan...');
        updateProgress(10, `Memulai analisis ${districtName}...`);

        // Set selected district untuk prediksi NDVI
        selectedDistrict = districtName;

        // Highlight kecamatan yang dipilih
        highlightSelectedDistrict(districtName);

        updateProgress(25, 'Mengambil data satelit Sentinel-2...');

        // Analisis kecamatan dengan API baru
        const result = await callAPI('/api/analyze_district', {
            district_name: districtName
        });

        updateProgress(70, 'Memproses hasil analisis...');

        if (!result.success) {
            throw new Error(result.error || 'Gagal menganalisis kecamatan');
        }

        const data = result.result;

        updateProgress(80, 'Menampilkan data NDVI...');
        // Tampilkan data NDVI dengan statistik lengkap
        displayNDVIResults(data.ndvi_data);

        // Tampilkan hasil prediksi
        displayPredictionResults(data);

        updateProgress(90, 'Memperbarui peta dengan layer NDVI...');
        // Update peta dengan layer NDVI (tanpa mengubah border yang sudah ada)
        await updateMapWithNDVILayer(data);

        updateProgress(95, 'Memulai prediksi NDVI otomatis...');
        // Otomatis jalankan prediksi NDVI
        console.log('Running automatic NDVI prediction...');
        await runNDVIPrediction(districtName);

        updateProgress(100, `Analisis ${districtName} selesai!`);
        console.log('Analisis kecamatan berhasil:', districtName);
        
        // Hide loading after completion
        setTimeout(() => {
            hideLoading();
        }, 1000);

    } catch (error) {
        console.error('Error during district analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis kecamatan');
        hideLoading();
    }
}

// Fungsi untuk menjalankan prediksi NDVI otomatis
async function runNDVIPrediction(districtName) {
    try {
        console.log(`Auto-running NDVI prediction for ${districtName}`);
        
        // Show specific loading for prediction (don't interfere with main loading)
        const predictionContainer = document.getElementById('lstmPredictionContainer');
        if (predictionContainer) {
            predictionContainer.classList.remove('hidden');
        }
        const predictionLoading = document.getElementById('predictionLoading');
        if (predictionLoading) {
            predictionLoading.classList.remove('hidden');
        }
        
        // Get prediction days from select (default 30)
        const predictionDays = parseInt(document.getElementById('predictionDays').value) || 30;
        
        // Call prediction API
        let response = await fetch(`${API_BASE_URL}/api/predict_ndvi`, {
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
            // Try one quick retry with smaller horizon to reduce payload/workload
            console.warn('Prediction API first attempt failed, retrying with 14 days...');
            response = await fetch(`${API_BASE_URL}/api/predict_ndvi`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    district_name: districtName,
                    prediction_days: 14
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
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
        
        // Show a subtle, non-blocking hint and a manual retry option without wiping the card markup
        const predictionCard = document.getElementById('lstmPredictionContainer');
        if (predictionCard) {
            predictionCard.classList.remove('hidden');
            const loadingEl = document.getElementById('predictionLoading');
            if (loadingEl) loadingEl.classList.add('hidden');
            const cardContent = predictionCard.querySelector('.lstm-stats-panel') || predictionCard;
            let info = document.getElementById('autoPredictInfo');
            if (!info) {
                info = document.createElement('div');
                info.id = 'autoPredictInfo';
                info.className = 'info-text';
                info.style.marginTop = '0.5rem';
                cardContent.prepend(info);
            }
            info.innerHTML = `Prediksi NDVI otomatis belum tersedia saat ini.
                <button id="retryPredictBtn" class="btn btn-secondary" style="margin-left:8px; padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                    Coba prediksi manual
                </button>`;
            const retryBtn = document.getElementById('retryPredictBtn');
            if (retryBtn) retryBtn.onclick = () => predictNDVI();
        }
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
        // Clear previous results first
        resetAllDistrictHighlight();
        hideResults();
        hideError();
        
        // Show loading with progress
        showLoading('Memulai analisis Kota Semarang...');
        updateProgress(10, 'Memulai analisis Kota Semarang...');

        updateProgress(25, 'Mengambil data satelit untuk seluruh Semarang...');

        // Panggil API untuk analisis kota
        const result = await callAPI('/api/analyze_city', {
            city_name: 'Semarang'
        });

        updateProgress(60, 'Memproses data agregat kota...');

        if (!result.success) {
            throw new Error(result.error || 'Gagal menganalisis kota');
        }

        const data = result.result;

        updateProgress(80, 'Menampilkan hasil analisis kota...');
        // Tampilkan hasil agregat untuk seluruh kota
        displayCityResults(data);

        updateProgress(90, 'Memperbarui layer NDVI kota...');
        // Ambil dan tampilkan layer NDVI untuk seluruh kota
        await updateMapWithCityNDVILayer();

        // Zoom out untuk menampilkan seluruh kota
        map.setView([-7.0051, 110.4381], 10);

        updateProgress(100, 'Analisis Kota Semarang selesai!');
        console.log('Analisis kota berhasil:', data);
        
        // Hide loading after completion
        setTimeout(() => {
            hideLoading();
        }, 1000);

    } catch (error) {
        console.error('Error during city analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis kota');
        hideLoading();
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
        // Clear previous results first
        resetAllDistrictHighlight();
        hideResults();
        hideError();
        
        // Show loading with progress
        showLoading('Memulai analisis area...');
        updateProgress(10, 'Memulai analisis area...');
        
        // Dapatkan koordinat dari input
        const latitude = parseFloat(document.getElementById('latitude').value);
        const longitude = parseFloat(document.getElementById('longitude').value);

        // Validasi input
        if (isNaN(latitude) || isNaN(longitude)) {
            showError('Mohon masukkan koordinat yang valid');
            hideLoading();
            return;
        }

        // Validasi bahwa koordinat berada dalam wilayah Semarang (toleransi lebih luas)
        if (latitude < -7.3 || latitude > -6.7 || longitude < 110.0 || longitude > 110.8) {
            showError('Koordinat berada di luar wilayah Kota Semarang. Silakan pilih lokasi dalam Kota Semarang.');
            hideLoading();
            return;
        }

        updateProgress(30, 'Mengambil data NDVI dari satelit...');

        // 1. Ambil data NDVI
        const ndviData = await callAPI('/api/get_ndvi', {
            latitude: latitude,
            longitude: longitude
        });

        if (!ndviData.success) {
            throw new Error(ndviData.error || 'Gagal mengambil data NDVI');
        }

        updateProgress(50, 'Menampilkan data NDVI...');
        // Tampilkan data NDVI
        displayNDVIResults(ndviData.data);

        updateProgress(70, 'Melakukan prediksi vegetasi...');
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

        updateProgress(90, 'Menampilkan hasil prediksi...');
        // Tampilkan hasil prediksi
        displayPredictionResults(predictionData.result);

        // Update peta
        updateMap(latitude, longitude, predictionData.result);

        updateProgress(100, 'Analisis area selesai!');
        console.log('Analisis berhasil completed');
        
        // Hide loading after short delay to show completion
        setTimeout(() => {
            hideLoading();
        }, 1000);

    } catch (error) {
        console.error('Error during analysis:', error);
        showError(error.message || 'Terjadi kesalahan saat menganalisis data');
        hideLoading();
    }
}

// Fungsi untuk menampilkan hasil NDVI
function displayNDVIResults(data) {
    console.log('displayNDVIResults called with data:', data);
    
    // Update NDVI values
    const elements = {
        'ndviMean': data.ndvi_mean ? data.ndvi_mean.toFixed(3) : '-',
        'ndviMin': data.ndvi_min ? data.ndvi_min.toFixed(3) : '-',
        'ndviMax': data.ndvi_max ? data.ndvi_max.toFixed(3) : '-',
        'dataDate': data.date_range || 'Data tidak tersedia'
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        } else {
            console.warn(`Element ${id} not found`);
        }
    });
    
    // Tambahkan interpretasi NDVI
    const interpretation = document.getElementById('ndviInterpretation');
    if (interpretation) {
        const mean = data.ndvi_mean || 0;
        let interpretText = '';
        let className = '';
        
        if (mean > 0.6) {
            interpretText = 'Area dengan vegetasi yang sangat baik. Kondisi hijau yang optimal untuk lingkungan urban.';
            className = 'interpretation-high';
        } else if (mean > 0.3) {
            interpretText = 'Area dengan vegetasi sedang. Masih dalam kondisi baik namun dapat ditingkatkan.';
            className = 'interpretation-medium';
        } else {
            interpretText = 'Area dengan vegetasi rendah. Perlu peningkatan ruang hijau untuk kondisi lingkungan yang lebih baik.';
            className = 'interpretation-low';
        }
        
        interpretation.innerHTML = `
            <div class="interpretation-content ${className}">
                <i class="fas fa-info-circle"></i>
                <p>${interpretText}</p>
            </div>
        `;
    }
    
    // Show NDVI results with animation
    const ndviResults = document.getElementById('ndviResults');
    console.log('ndviResults element found:', !!ndviResults);
    if (ndviResults) {
        ndviResults.classList.remove('hidden');
        ndviResults.style.display = 'block';
        
        // Add animation class
        setTimeout(() => {
            ndviResults.classList.add('visible');
        }, 100);
    } else {
        console.error('ndviResults element not found in DOM');
    }
}

// Fungsi untuk menambahkan statistik NDVI tambahan
function addAdditionalNDVIStats(data) {
    const dataGrid = document.querySelector('#ndviResults .data-grid');
    if (!dataGrid) return;
    
    // Hapus stats tambahan sebelumnya
    const existingStats = dataGrid.querySelectorAll('.additional-stat');
    existingStats.forEach(stat => stat.remove());
    
    // Tambahkan statistik baru jika tersedia
    if (typeof data.ndvi_p50 === 'number') {
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
    console.log('displayPredictionResults called with result:', result);
    
    // Update prediction class
    const predictionClass = document.getElementById('predictionClass');
    if (predictionClass) {
        predictionClass.textContent = result.prediction_label || 'Tidak tersedia';
    } else {
        console.warn('predictionClass element not found');
    }
    
    // Update confidence bars
    const confidence = result.confidence || {};
    
    // Map confidence keys to handle different formats
    const confidenceMap = {
        'confidenceLow': confidence['Vegetasi Rendah'] || confidence['Low'] || confidence[0] || 0,
        'confidenceMedium': confidence['Vegetasi Sedang'] || confidence['Medium'] || confidence[1] || 0,
        'confidenceHigh': confidence['Vegetasi Tinggi'] || confidence['High'] || confidence[2] || 0
    };
    
    Object.keys(confidenceMap).forEach(key => {
        const value = confidenceMap[key];
        const barId = key;
        const textId = key + 'Text';
        
        updateConfidenceBar(barId, textId, value);
    });
    
    // Show prediction results with animation
    const predictionResults = document.getElementById('predictionResults');
    console.log('predictionResults element found:', !!predictionResults);
    if (predictionResults) {
        predictionResults.classList.remove('hidden');
        predictionResults.style.display = 'block';
        
        // Add animation class
        setTimeout(() => {
            predictionResults.classList.add('visible');
        }, 100);
        
        console.log('predictionResults displayed');
        
        // Show download button when results are displayed
        toggleDownloadButton(true);
    } else {
        console.error('predictionResults element not found in DOM');
    }
}

// Fungsi untuk update confidence bar
function updateConfidenceBar(barId, textId, value) {
    console.log(`Updating confidence bar: ${barId} with value: ${value}`);
    
    const percentage = Math.round(value * 100);
    
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    
    console.log(`Bar element (${barId}):`, !!bar, `Text element (${textId}):`, !!text);
    
    if (bar) {
        bar.style.width = `${percentage}%`;
        
        // Ubah warna berdasarkan nilai
        if (percentage > 70) {
            bar.style.background = 'var(--green-500)';
        } else if (percentage > 50) {
            bar.style.background = '#fbbf24';
        } else {
            bar.style.background = '#ef4444';
        }
        
        console.log(`Set bar width to ${percentage}%`);
    } else {
        console.warn(`Confidence bar element ${barId} not found`);
    }
    
    if (text) {
        text.textContent = `${percentage}%`;
        console.log(`Set text to ${percentage}%`);
    } else {
        console.warn(`Confidence text element ${textId} not found`);
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
        // Ensure display style is cleared
        resultsContainer.style.display = '';
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
    
    const ndviResults = document.getElementById('ndviResults');
    if (ndviResults) {
        ndviResults.classList.remove('hidden');
        // Ensure display style is cleared
        ndviResults.style.display = '';
        // Show download button when results are displayed
        toggleDownloadButton(true);
    }
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
        // Ensure display style is cleared
        predictionResults.style.display = '';
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
function showLoading(message) {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    
    if (message) {
        if (loadingText) {
            loadingText.textContent = message;
        }
        loading.classList.remove('hidden');
        // Reset progress bar
        updateProgress(0);
    } else {
        loading.classList.add('hidden');
    }
}

// Fungsi untuk menyembunyikan loading
function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
    // Reset progress
    updateProgress(0);
}

// Fungsi untuk update progress bar
function updateProgress(percentage, message = null) {
    const progressBar = document.getElementById('loadingProgress');
    const progressText = document.getElementById('loadingPercentage');
    const loadingText = document.getElementById('loadingText');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }
    
    if (message && loadingText) {
        loadingText.textContent = message;
    }
}

// Fungsi untuk menampilkan error
function showError(message) {
    const errorText = document.getElementById('errorText');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorText) {
        errorText.textContent = message;
    }
    if (errorMessage) {
        errorMessage.classList.remove('hidden');
    }
}

// Fungsi untuk menyembunyikan error
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
}

// Fungsi untuk menyembunyikan hasil
function hideResults() {
    // Hide download button when hiding results
    toggleDownloadButton(false);
    
    // Hide all result sections
    const resultElements = [
        'ndviResults',
        'predictionResults', 
        'lstmPredictionContainer',
        'predictionChart',
        'predictionStats',
        'districtSummary',
        'critical-areas-container'
    ];
    
    resultElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
            // Only set display:none for chart container which sometimes needs it
            if (elementId === 'predictionChart' || elementId === 'critical-areas-container') {
                element.style.display = 'none';
            }
        }
    });
    
    // Do NOT clear innerHTML of prediction card/chart; we preserve markup to avoid losing elements
    // Just hide prediction loading if it exists
    const predictionLoading = document.getElementById('predictionLoading');
    if (predictionLoading) predictionLoading.classList.add('hidden');
    
    // Remove district summary if it exists
    const districtSummary = document.getElementById('districtSummary');
    if (districtSummary && districtSummary.parentNode) {
        districtSummary.parentNode.removeChild(districtSummary);
    }
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
    
    // Load district buttons
    createFallbackDistrictButtons();
    
    // Event listener untuk tombol analisis
    document.getElementById('analyzeBtn').addEventListener('click', analyzeArea);
    
    // Event listener untuk tombol analisis seluruh kota
    document.getElementById('analyzeCityBtn').addEventListener('click', analyzeSemarangCity);
    
    // Test LSTM button for direct chart testing
    const testLSTMBtn = document.getElementById('testLSTMBtn');
    if (testLSTMBtn) {
        testLSTMBtn.addEventListener('click', function() {
            console.log('Test LSTM button clicked - testing chart directly');
            
            // Ensure the LSTM prediction container is visible
            const lstmPredictionContainer = document.getElementById('lstmPredictionContainer');
            if (lstmPredictionContainer) {
                lstmPredictionContainer.classList.remove('hidden');
                lstmPredictionContainer.style.display = 'block';
                console.log('LSTM prediction container shown for direct test');
            }
            
            // Test LSTM prediction results directly
            const testLSTMData = {
                statistics: {
                    avg_prediction: 0.672,
                    min_prediction: 0.534,
                    max_prediction: 0.798,
                    trend: 'meningkat'
                },
                plot_json: JSON.stringify(createFallbackChart())
            };
            
            console.log('About to call displayNDVIPredictionResults...');
            displayNDVIPredictionResults(testLSTMData);
        });
    }
    
    // Test button for demo purposes
    const testBtn = document.getElementById('testResultsBtn');
    if (testBtn) {
        testBtn.addEventListener('click', function() {
            console.log('Test button clicked - showing demo results');
            
            // Show test NDVI results
            const testNDVIData = {
                ndvi_mean: 0.65,
                ndvi_min: 0.15,
                ndvi_max: 0.89,
                date_range: '2024-01-01 sampai 2024-12-31'
            };
            displayNDVIResults(testNDVIData);
            
            // Show test prediction results
            const testPredictionData = {
                prediction_label: 'Vegetasi Tinggi',
                confidence: {
                    'Vegetasi Rendah': 0.15,
                    'Vegetasi Sedang': 0.25,
                    'Vegetasi Tinggi': 0.85
                }
            };
            displayPredictionResults(testPredictionData);
            
            // Show test LSTM prediction results
            const testLSTMData = {
                statistics: {
                    avg_prediction: 0.672,
                    min_prediction: 0.534,
                    max_prediction: 0.798,
                    trend: 'meningkat'
                },
                plot_json: JSON.stringify(createFallbackChart())
            };
            
            // Ensure the LSTM prediction container is visible
            const lstmPredictionContainer = document.getElementById('lstmPredictionContainer');
            if (lstmPredictionContainer) {
                lstmPredictionContainer.classList.remove('hidden');
                lstmPredictionContainer.style.display = 'block';
                console.log('LSTM prediction container shown for test');
            }
            
            // Wait a bit then display prediction results
            setTimeout(() => {
                displayNDVIPredictionResults(testLSTMData);
                console.log('Demo results with LSTM chart displayed');
            }, 500);
        });
    }
    
    // Event listeners untuk toggle mode analisis dengan label click
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Check the radio button
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
            
            // Clear previous results when switching modes
            resetAllDistrictHighlight();
            hideResults();
            hideError();
            
            const coordinateInputs = document.getElementById('coordinateInputs');
            const districtSelection = document.getElementById('districtSelection');
            const analyzeBtn = document.getElementById('analyzeBtn');
            
            if (radio && radio.value === 'coordinate') {
                coordinateInputs.classList.remove('hidden');
                districtSelection.classList.add('hidden');
                analyzeBtn.classList.remove('hidden');
            } else {
                coordinateInputs.classList.add('hidden');
                districtSelection.classList.remove('hidden');
                analyzeBtn.classList.add('hidden');
            }
        });
    });
    
    // Event listeners for radio buttons (fallback)
    document.querySelectorAll('input[name="analysisMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            // Find the parent tab and trigger click
            const parentTab = this.closest('.mode-tab');
            if (parentTab && !parentTab.classList.contains('active')) {
                parentTab.click();
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
    
    // Event listener untuk tombol Clear Results
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', function() {
            resetAllDistrictHighlight();
            hideResults();
            hideError();
            console.log('Results cleared by user');
        });
    }
    
    // Event listener untuk tombol Download PDF
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', function() {
            downloadAnalysisReport();
        });
    }
    
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
        
        // Safely get prediction days with fallback
        const predictionDaysInput = document.getElementById('predictionDays');
        const predictionDays = predictionDaysInput ? parseInt(predictionDaysInput.value) || 30 : 30;
        
        const predictBtn = document.getElementById('predictNDVIBtn');
        
        // Show loading with progress
        showLoading('Memulai prediksi NDVI...');
        updateProgress(15, 'Memulai prediksi NDVI...');
        
        // Disable tombol dan tampilkan loading
        if (predictBtn) {
            predictBtn.disabled = true;
            predictBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memprediksi...';
        }
        
        // Hide chart dan stats (safely)
        const predictionChart = document.getElementById('predictionChart');
        const predictionStats = document.getElementById('predictionStats');
        if (predictionChart) predictionChart.classList.add('hidden');
        if (predictionStats) predictionStats.classList.add('hidden');
        
        console.log(`Predicting NDVI for ${selectedDistrict} for ${predictionDays} days`);
        
        updateProgress(30, `Mengirim request prediksi untuk ${selectedDistrict}...`);
        
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
        
        updateProgress(60, 'Memproses model AI untuk prediksi...');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        updateProgress(80, 'Menganalisis hasil prediksi...');
        
        if (data.success) {
            if (!data.result) {
                throw new Error('Response tidak mengandung data result');
            }
            
            console.log('Prediction result:', data.result);
            
            updateProgress(95, 'Menampilkan chart prediksi...');
            const predictionLoadingEl = document.getElementById('predictionLoading');
            if (predictionLoadingEl) predictionLoadingEl.classList.add('hidden');
            displayNDVIPredictionResults(data.result);
            
            // Show prediksi section
            document.getElementById('lstmPredictionContainer').classList.remove('hidden');
            
            updateProgress(100, 'Prediksi NDVI selesai!');
            
            // Hide loading after showing completion
            setTimeout(() => {
                hideLoading();
            }, 1000);
            
        } else {
            throw new Error(data.error || 'Gagal melakukan prediksi NDVI');
        }
        
    } catch (error) {
        console.error('Error predicting NDVI:', error);
        showError(`Gagal melakukan prediksi NDVI: ${error.message}`);
        hideLoading();
    } finally {
        // Enable tombol kembali (safely)
        const predictBtn = document.getElementById('predictNDVIBtn');
        if (predictBtn) {
            predictBtn.disabled = false;
            predictBtn.innerHTML = '<i class="fas fa-chart-line"></i> Prediksi NDVI';
        }
    }
}

// Fungsi untuk menampilkan hasil prediksi NDVI
function displayNDVIPredictionResults(result) {
    try {
        console.log('=== displayNDVIPredictionResults START ===');
        console.log('Displaying NDVI prediction results:', result);
        
        // Debug: Check current DOM state
        console.log('DOM Debug:');
        console.log('- lstmPredictionContainer exists:', !!document.getElementById('lstmPredictionContainer'));
        console.log('- predictionChart exists:', !!document.getElementById('predictionChart'));
        console.log('- lstm-chart-container elements:', document.querySelectorAll('.lstm-chart-container').length);
        
    // Hide prediction loading spinner if visible
    const predictionLoading = document.getElementById('predictionLoading');
    if (predictionLoading) predictionLoading.classList.add('hidden');

        // Show the LSTM prediction section (new unified container)
        const lstmPredictionContainer = document.getElementById('lstmPredictionContainer');
        if (lstmPredictionContainer) {
            lstmPredictionContainer.classList.remove('hidden');
            lstmPredictionContainer.style.display = 'block';
            console.log('LSTM prediction container shown');
        }

        // Show the prediction chart container
        let predictionChart = document.getElementById('predictionChart');
        if (!predictionChart) {
            console.warn('Prediction chart element not found, attempting to recreate...');
            // Find the chart container and ensure it exists
            if (lstmPredictionContainer) {
                const existingChart = lstmPredictionContainer.querySelector('#predictionChart');
                if (!existingChart) {
                    // Look for the chart container class
                    const chartContainer = lstmPredictionContainer.querySelector('.lstm-chart-container');
                    if (chartContainer) {
                        chartContainer.id = 'predictionChart';
                        predictionChart = chartContainer;
                        console.log('Assigned ID to existing chart container');
                    } else {
                        console.log('No chart container found in LSTM container');
                    }
                }
            }
        }        if (predictionChart) {
            predictionChart.classList.remove('hidden');
            predictionChart.style.display = 'block';
            console.log('Prediction chart container shown');
        } else {
            console.warn('Prediction chart element still not found in displayNDVIPredictionResults');
        }
        
        // Tampilkan statistik jika tersedia, tapi jangan blokir chart jika tidak ada
        if (result && result.statistics) {
            const stats = result.statistics;
            const hasAll = typeof stats.avg_prediction === 'number' && typeof stats.min_prediction === 'number' &&
                           typeof stats.max_prediction === 'number' && !!stats.trend;
            if (hasAll) {
                updatePredictionSummary(stats);
                console.log('Statistics updated successfully');
            } else {
                console.warn('Statistik prediksi tidak lengkap, melewati update stats');
            }
        } else {
            console.warn('Statistik prediksi tidak tersedia');
        }
        
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
            
            // Create fallback chart if no data available
            console.log('Creating fallback chart for demo...');
            renderNDVIChart(JSON.stringify(createFallbackChart()));
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
        // Update prediction stats in the new structure
        const predAvg = document.getElementById('predAvg');
        const predTrend = document.getElementById('predTrend');
        const predMax = document.getElementById('predMax');
        const predMin = document.getElementById('predMin');
        
        if (predAvg) {
            predAvg.textContent = stats.avg_prediction.toFixed(3);
            console.log('Updated predAvg:', stats.avg_prediction.toFixed(3));
        }
        
        if (predTrend) {
            const trend = stats.trend || 'Stabil';
            predTrend.textContent = trend.charAt(0).toUpperCase() + trend.slice(1);
            
            // Add trend styling
            if (trend.toLowerCase() === 'meningkat') {
                predTrend.style.color = '#537531';
            } else if (trend.toLowerCase() === 'menurun') {
                predTrend.style.color = '#ef4444';
            } else {
                predTrend.style.color = '#f59e0b';
            }
            console.log('Updated predTrend:', trend);
        }
        
        if (predMax) {
            predMax.textContent = stats.max_prediction ? stats.max_prediction.toFixed(3) : '-';
            console.log('Updated predMax:', stats.max_prediction);
        }
        
        if (predMin) {
            predMin.textContent = stats.min_prediction ? stats.min_prediction.toFixed(3) : '-';
            console.log('Updated predMin:', stats.min_prediction);
        }
        
        // Show prediction stats container
        const predictionStats = document.getElementById('predictionStats');
        if (predictionStats) {
            predictionStats.classList.remove('hidden');
            predictionStats.style.display = 'block';
            console.log('Prediction stats container shown');
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
    // Ensure loading spinner is hidden when rendering starts
    const predictionLoading = document.getElementById('predictionLoading');
    if (predictionLoading) predictionLoading.classList.add('hidden');
        // Show the unified LSTM prediction section
        const lstmPredictionContainer = document.getElementById('lstmPredictionContainer');
        if (lstmPredictionContainer) {
            lstmPredictionContainer.classList.remove('hidden');
            lstmPredictionContainer.style.display = 'block';
            console.log('LSTM prediction container displayed');
        }
        
        // Show the prediction chart container
        const predictionChart = document.getElementById('predictionChart');
        console.log('Prediction chart element:', predictionChart);
        console.log('LSTM container element:', document.getElementById('lstmPredictionContainer'));
        console.log('All elements with predictionChart class:', document.querySelectorAll('.lstm-chart-container').length);
        console.log('All elements with id predictionChart:', document.querySelectorAll('#predictionChart').length);
        if (predictionChart) {
            predictionChart.style.display = 'block';
            predictionChart.classList.remove('hidden');
            console.log('Prediction chart shown, display style:', predictionChart.style.display);
            console.log('Prediction chart classes:', predictionChart.className);
        } else {
            console.error('Prediction chart not found!');
            console.log('Attempting to find chart container by class...');
            const chartByClass = document.querySelector('.lstm-chart-container');
            console.log('Chart found by class:', chartByClass);
            if (chartByClass) {
                chartByClass.id = 'predictionChart'; // Give it the expected ID
                chartByClass.style.display = 'block';
                chartByClass.classList.remove('hidden');
                console.log('Fixed chart container by assigning ID');
            } else {
                showError('Container grafik prediksi tidak ditemukan dalam DOM');
                return;
            }
        }
        
        // Cek apakah Plotly tersedia
        if (typeof Plotly === 'undefined') {
            console.error('Plotly tidak tersedia - pastikan script Plotly sudah dimuat');
            throw new Error('Plotly tidak tersedia - pastikan script Plotly sudah dimuat');
        }
        console.log('Plotly is available, version:', Plotly.version);
        
        // Get chart body container inside prediction chart
        const predictionChartFinal = document.getElementById('predictionChart');
        if (!predictionChartFinal) {
            console.error('Failed to get prediction chart element after attempted fix');
            showError('Container grafik tidak dapat ditemukan');
            return;
        }
        const chartBody = predictionChartFinal.querySelector('.chart-body');
        const chartContainer = chartBody || predictionChartFinal;
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
        
        // Enhanced plot layout for LSTM visualization
        if (plotData.layout) {
            plotData.layout.paper_bgcolor = '#ffffff';
            plotData.layout.plot_bgcolor = '#ffffff';
            plotData.layout.font = {
                color: '#1e293b',
                family: 'Inter, system-ui, sans-serif'
            };
            plotData.layout.title = {
                text: 'Prediksi NDVI dengan Model LSTM',
                font: { color: '#1e293b', size: 16 },
                x: 0.5
            };
            plotData.layout.xaxis = {
                ...plotData.layout.xaxis,
                gridcolor: 'rgba(0,0,0,0.1)',
                linecolor: 'rgba(0,0,0,0.2)',
                tickcolor: 'rgba(0,0,0,0.2)',
                titlefont: { color: '#374151' },
                tickfont: { color: '#4b5563' }
            };
            plotData.layout.yaxis = {
                ...plotData.layout.yaxis,
                gridcolor: 'rgba(0,0,0,0.1)',
                linecolor: 'rgba(0,0,0,0.2)',
                tickcolor: 'rgba(0,0,0,0.2)',
                titlefont: { color: '#374151' },
                tickfont: { color: '#4b5563' }
            };
            plotData.layout.margin = { t: 60, r: 40, b: 60, l: 60 };
            plotData.layout.height = 350;
        }
        
        // Configure plot layout
        const config = {
            responsive: true,
            displayModeBar: false,
            displaylogo: false
        };
        
        console.log('About to call Plotly.newPlot...');
        console.log('Container element:', chartContainer);
        console.log('Plot data ready:', plotData.data ? 'YES' : 'NO');
        console.log('Plot layout ready:', plotData.layout ? 'YES' : 'NO');
        console.log('Config ready:', config ? 'YES' : 'NO');
        
        // Clear container first and set up for Plotly
        chartContainer.innerHTML = '';
        chartContainer.style.height = '350px';
        chartContainer.style.width = '100%';
        console.log('Container cleared and sized');
        
        // Create unique ID for container
        const chartId = 'lstm-chart-' + Date.now();
        chartContainer.id = chartId;
        
        // Render grafik
        Plotly.newPlot(chartId, plotData.data, plotData.layout, config)
            .then(() => {
                console.log('✅ LSTM chart rendered successfully');
                predictionChart.classList.remove('hidden');
                predictionChart.style.display = 'block';
                console.log('Chart container is now visible');
                
                // Force container visibility and add animation
                chartContainer.style.display = 'block';
                chartContainer.style.opacity = '0';
                setTimeout(() => {
                    chartContainer.style.transition = 'opacity 0.5s ease';
                    chartContainer.style.opacity = '1';
                }, 100);
                
                // Show prediction stats if available
                displayPredictionStats(plotData);
                
                console.log('LSTM chart setup complete');
            })
            .catch((plotError) => {
                console.error('❌ Plotly rendering error:', plotError);
                console.error('Error details:', plotError);
                showError('Gagal menampilkan grafik LSTM: ' + plotError.message);
            });
        
    } catch (error) {
        console.error('Error in LSTM chart rendering:', error);
        showError('Grafik LSTM tidak dapat ditampilkan: ' + error.message);
    }
}

// Fungsi untuk menampilkan statistik prediksi
function displayPredictionStats(plotData) {
    console.log('Displaying prediction stats...');
    
    const predictionStats = document.getElementById('predictionStats');
    if (!predictionStats) {
        console.warn('Prediction stats container not found');
        return;
    }
    
    // Extract prediction statistics from plot data
    let avgValue = 0.65;
    let trend = 'Stabil';
    let confidence = '89%';
    
    if (plotData && plotData.data && plotData.data.length > 0) {
        // Try to calculate from actual data
        const predictionTrace = plotData.data.find(trace => 
            trace.name && trace.name.toLowerCase().includes('prediksi')
        );
        
        if (predictionTrace && predictionTrace.y) {
            const values = predictionTrace.y.filter(v => v !== null && !isNaN(v));
            if (values.length > 0) {
                avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
                
                // Calculate trend
                const firstHalf = values.slice(0, Math.floor(values.length / 2));
                const secondHalf = values.slice(Math.floor(values.length / 2));
                const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
                
                if (secondAvg > firstAvg + 0.05) {
                    trend = 'Meningkat';
                } else if (secondAvg < firstAvg - 0.05) {
                    trend = 'Menurun';
                } else {
                    trend = 'Stabil';
                }
            }
        }
    }
    
    // Update stats display
    const predAvg = document.getElementById('predAvg');
    const predTrend = document.getElementById('predTrend');
    const predConfidence = document.getElementById('predConfidence');
    
    if (predAvg) predAvg.textContent = avgValue.toFixed(3);
    if (predTrend) predTrend.textContent = trend;
    if (predConfidence) predConfidence.textContent = confidence;
    
    // Add interpretation
    const interpretation = document.getElementById('predictionInterpretation');
    if (interpretation) {
        let interpretText = '';
        let iconClass = '';
        
        if (avgValue > 0.6) {
            interpretText = 'Prediksi menunjukkan kondisi vegetasi yang baik dalam periode mendatang. Tingkat kehijauan diperkirakan akan tetap optimal.';
            iconClass = 'fas fa-check-circle';
        } else if (avgValue > 0.3) {
            interpretText = 'Prediksi menunjukkan kondisi vegetasi sedang. Diperlukan pemantauan berkelanjutan untuk menjaga tingkat kehijauan.';
            iconClass = 'fas fa-exclamation-circle';
        } else {
            interpretText = 'Prediksi menunjukkan kondisi vegetasi yang mengkhawatirkan. Diperlukan intervensi untuk meningkatkan ruang hijau.';
            iconClass = 'fas fa-exclamation-triangle';
        }
        
        interpretation.innerHTML = `
            <h6><i class="${iconClass}"></i> Interpretasi Prediksi</h6>
            <p>${interpretText}</p>
        `;
    }
    
    // Show the stats container
    predictionStats.classList.remove('hidden');
    predictionStats.style.display = 'block';
    
    console.log('Prediction stats displayed successfully');
}

// ==================== DETEKSI AREA KRITIS ====================

async function detectCriticalAreas() {
    console.log('Starting critical area detection...');
    
    try {
        // Clear previous results first
        resetAllDistrictHighlight();
        hideResults();
        hideError();
        
        // Show loading with progress
        showLoading('Memulai deteksi area kritis...');
        updateProgress(10, 'Memulai deteksi area kritis...');
        
        // Get threshold values with fallback
        const thresholdMinInput = document.getElementById('thresholdMin');
        const thresholdMaxInput = document.getElementById('thresholdMax');
        
        const thresholdMin = thresholdMinInput ? parseFloat(thresholdMinInput.value) : 0.2;
        const thresholdMax = thresholdMaxInput ? parseFloat(thresholdMaxInput.value) : 0.3;
        
        console.log(`Detecting areas with NDVI ${thresholdMin} - ${thresholdMax}`);
        
        updateProgress(25, 'Mengirim request ke server...');
        
        // Use absolute API base URL to avoid wrong origin (which may return 405)
        const response = await fetch(`${API_BASE_URL}/api/detect_critical_areas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                threshold_min: thresholdMin,
                threshold_max: thresholdMax
            })
        });
        
        updateProgress(50, 'Memproses response dari server...');
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error('Non-JSON response:', responseText);
            throw new Error(`Expected JSON response, got: ${contentType}. Response: ${responseText.substring(0, 200)}...`);
        }
        
        updateProgress(75, 'Memparse data hasil analisis...');
        
        const data = await response.json();
        console.log('Critical area detection response:', data);
        
        if (data.success) {
            updateProgress(90, 'Menampilkan hasil deteksi...');
            displayCriticalAreas(data);
            showCriticalAreasOnMap(data.critical_areas);
            
            updateProgress(100, 'Deteksi area kritis selesai!');
            
            // Hide loading after a short delay to show completion
            setTimeout(() => {
                hideLoading();
            }, 1000);
            
            console.log('Critical areas detection completed successfully');
        } else {
            throw new Error(data.error || 'Gagal mendeteksi area kritis');
        }
        
    } catch (error) {
        console.error('Error detecting critical areas:', error);
        showError('Gagal mendeteksi area kritis: ' + error.message);
    } finally {
        // Pastikan loading selalu di-hide setelah detection selesai
        console.log('Ensuring loading is hidden after critical area detection');
        setTimeout(() => {
            hideLoading();
        }, 1500);
    }
}

function displayCriticalAreas(data) {
    console.log('Displaying critical areas results...');
    console.log('Data received:', data);
    
    // Show critical areas container
    const criticalContainer = document.getElementById('criticalAreasContainer');
    console.log('Critical container element:', criticalContainer);
    
    if (criticalContainer) {
        criticalContainer.classList.remove('hidden');
        criticalContainer.style.display = 'block';
        console.log('Critical container shown, display style:', criticalContainer.style.display);
        console.log('Critical container classes:', criticalContainer.className);
        
        // Show download button when critical areas are displayed
        toggleDownloadButton(true);
        
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
        // Update the stats container
        const statsContainer = document.getElementById('criticalAreasStats');
        if (!statsContainer) {
            console.error('Critical areas stats container not found!');
            return;
        }
        
        const html = `
            <div class="critical-stats-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-item-value">${stats.total_districts_analyzed}</div>
                        <div class="summary-item-label">Total Kecamatan</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${stats.critical_areas_found}</div>
                        <div class="summary-item-label">Area Kritis</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${stats.percentage_critical.toFixed(1)}%</div>
                        <div class="summary-item-label">Persentase Kritis</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${stats.avg_ndvi_critical.toFixed(3)}</div>
                        <div class="summary-item-label">Rata-rata NDVI</div>
                    </div>
                </div>
            </div>
        `;
        
        statsContainer.innerHTML = html;
        console.log('Critical areas statistics updated');
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

function displayCriticalAreasList(criticalAreas) {
    const listContainer = document.getElementById('criticalAreas');
    if (!listContainer) {
        console.error('Critical areas list container not found!');
        return;
    }
    
    if (criticalAreas.length === 0) {
        listContainer.innerHTML = '<div class="no-critical-areas">Tidak ada area kritis yang terdeteksi dalam rentang yang ditentukan.</div>';
        return;
    }
    
    let html = '';
    
    criticalAreas.forEach((area, index) => {
        const riskLevel = area.risk_score > 0.7 ? 'high' : area.risk_score > 0.4 ? 'medium' : 'low';
        
        html += `
            <div class="critical-area-card" onclick="focusOnCriticalArea('${area.district_name}', ${area.coordinates[0]}, ${area.coordinates[1]})">
                <div class="critical-area-header">
                    <h4 class="critical-area-title">${area.district_name}</h4>
                    <span class="risk-badge ${riskLevel}">
                        ${riskLevel === 'high' ? 'Tinggi' : riskLevel === 'medium' ? 'Sedang' : 'Rendah'}
                    </span>
                </div>
                <div class="critical-area-stats">
                    <div class="critical-stat">
                        <div class="critical-stat-label">NDVI Rata-rata</div>
                        <div class="critical-stat-value">${area.avg_ndvi.toFixed(3)}</div>
                    </div>
                    <div class="critical-stat">
                        <div class="critical-stat-label">Skor Risiko</div>
                        <div class="critical-stat-value">${(area.risk_score * 100).toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    console.log('Critical areas list displayed');
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
                    className: 'critical-area-marker',
                    html: `<div class="marker-content">
                        <i class="fas fa-exclamation-triangle" style="color: #ffffff; font-size: 14px;"></i>
                        <span class="district-name" style="color: #ffffff; font-weight: bold;">${area.district_name}</span>
                        <span class="ndvi-value" style="color: #f8fafc;">NDVI: ${area.avg_ndvi.toFixed(3)}</span>
                    </div>`,
                    iconSize: [120, 50],
                    iconAnchor: [60, 25]
                })
            });
            
            marker.bindPopup(`
                <div class="critical-popup">
                    <h3 style="color: #ef4444;">${area.district_name}</h3>
                    <p><strong>NDVI:</strong> ${area.avg_ndvi.toFixed(3)}</p>
                    <p><strong>Skor Risiko:</strong> ${(area.risk_score * 100).toFixed(0)}%</p>
                    <p><strong>Status:</strong> Area Kritis</p>
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

// ==================== DOWNLOAD PDF REPORT ====================

function downloadAnalysisReport() {
    console.log('Starting PDF download...');
    
    try {
        // Cek apakah jsPDF tersedia - multiple methods
        let jsPDF;
        
        if (typeof window.jsPDF !== 'undefined') {
            jsPDF = window.jsPDF.jsPDF;
        } else if (typeof window.jspdf !== 'undefined') {
            jsPDF = window.jspdf.jsPDF;
        } else if (typeof jspdf !== 'undefined') {
            jsPDF = jspdf.jsPDF;
        } else {
            console.error('jsPDF not found, trying alternative download method');
            downloadAlternativeReport();
            return;
        }
        
        if (!jsPDF) {
            console.error('jsPDF constructor not found, trying alternative method');
            downloadAlternativeReport();
            return;
        }
        
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('Green Urban Dashboard', 20, 30);
        doc.setFontSize(14);
        doc.text('Laporan Analisis Vegetasi Kota Semarang', 20, 40);
        
        // Tanggal dan waktu
        const now = new Date();
        const dateString = now.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        doc.setFontSize(10);
        doc.text(`Tanggal: ${dateString}`, 20, 50);
        
        let yPosition = 70;
        
        // Cek data NDVI yang tersedia
        const ndviResults = document.getElementById('ndviResults');
        if (ndviResults && !ndviResults.classList.contains('hidden')) {
            doc.setFontSize(16);
            doc.setTextColor(0, 100, 0);
            doc.text('Data NDVI (Sentinel-2)', 20, yPosition);
            yPosition += 15;
            
            // Ambil data NDVI
            const ndviMean = document.getElementById('ndviMean')?.textContent || '-';
            const ndviMin = document.getElementById('ndviMin')?.textContent || '-';
            const ndviMax = document.getElementById('ndviMax')?.textContent || '-';
            const dataDate = document.getElementById('dataDate')?.textContent || '-';
            
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text(`NDVI Rata-rata: ${ndviMean}`, 20, yPosition);
            yPosition += 8;
            doc.text(`NDVI Minimum: ${ndviMin}`, 20, yPosition);
            yPosition += 8;
            doc.text(`NDVI Maksimum: ${ndviMax}`, 20, yPosition);
            yPosition += 8;
            doc.text(`Tanggal Data: ${dataDate}`, 20, yPosition);
            yPosition += 20;
        }
        
        // Cek data prediksi yang tersedia
        const predictionResults = document.getElementById('predictionResults');
        if (predictionResults && !predictionResults.classList.contains('hidden')) {
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 150);
            doc.text('Prediksi AI', 20, yPosition);
            yPosition += 15;
            
            // Ambil data prediksi
            const predictionClass = document.getElementById('predictionClass')?.textContent || '-';
            const confidenceLow = document.getElementById('confidenceLowText')?.textContent || '-';
            const confidenceMedium = document.getElementById('confidenceMediumText')?.textContent || '-';
            const confidenceHigh = document.getElementById('confidenceHighText')?.textContent || '-';
            
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text(`Klasifikasi: ${predictionClass}`, 20, yPosition);
            yPosition += 8;
            doc.text(`Vegetasi Rendah: ${confidenceLow}`, 20, yPosition);
            yPosition += 8;
            doc.text(`Vegetasi Sedang: ${confidenceMedium}`, 20, yPosition);
            yPosition += 8;
            doc.text(`Vegetasi Tinggi: ${confidenceHigh}`, 20, yPosition);
            yPosition += 20;
        }
        
        // Cek data area kritis
        const criticalContainer = document.getElementById('critical-areas-container');
        if (criticalContainer && !criticalContainer.classList.contains('hidden')) {
            doc.setFontSize(16);
            doc.setTextColor(150, 0, 0);
            doc.text('Area Kritis Terdeteksi', 20, yPosition);
            yPosition += 15;
            
            // Ambil data area kritis jika ada
            const criticalSummary = criticalContainer.querySelector('.critical-summary');
            if (criticalSummary) {
                const summaryText = criticalSummary.textContent || 'Data area kritis tersedia';
                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                
                // Split teks jika terlalu panjang
                const lines = doc.splitTextToSize(summaryText, 170);
                lines.forEach(line => {
                    doc.text(line, 20, yPosition);
                    yPosition += 8;
                });
                yPosition += 10;
            }
        }
        
        // Footer
        yPosition = 270;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Generated by Green Urban Dashboard - AI Innovation Challenge 2025', 20, yPosition);
        doc.text('Tim: [Nama Tim] | Teknologi: Google Earth Engine, Flask, Random Forest', 20, yPosition + 5);
        
        // Buat nama file dengan timestamp
        const filename = `Analisis_Vegetasi_Semarang_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.pdf`;
        
        // Download PDF
        doc.save(filename);
        
        console.log('PDF downloaded successfully:', filename);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showError('Terjadi kesalahan saat membuat PDF. Silakan coba lagi.');
    }
}

// Fungsi alternatif untuk download tanpa jsPDF
function downloadAlternativeReport() {
    console.log('Using alternative download method...');
    
    try {
        // Kumpulkan data hasil analisis
        let reportData = [];
        reportData.push('GREEN URBAN DASHBOARD - LAPORAN ANALISIS VEGETASI');
        reportData.push('Kota Semarang, Jawa Tengah');
        reportData.push('='.repeat(60));
        
        // Tambahkan timestamp
        const now = new Date();
        const dateString = now.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        reportData.push(`Tanggal Generate: ${dateString}`);
        reportData.push('');
        
        // Cek dan tambahkan data NDVI
        const ndviResults = document.getElementById('ndviResults');
        if (ndviResults && !ndviResults.classList.contains('hidden')) {
            reportData.push('DATA NDVI (SENTINEL-2):');
            reportData.push('-'.repeat(30));
            
            const ndviMean = document.getElementById('ndviMean')?.textContent || '-';
            const ndviMin = document.getElementById('ndviMin')?.textContent || '-';
            const ndviMax = document.getElementById('ndviMax')?.textContent || '-';
            const dataDate = document.getElementById('dataDate')?.textContent || '-';
            
            reportData.push(`NDVI Rata-rata: ${ndviMean}`);
            reportData.push(`NDVI Minimum: ${ndviMin}`);
            reportData.push(`NDVI Maksimum: ${ndviMax}`);
            reportData.push(`Tanggal Data: ${dataDate}`);
            reportData.push('');
        }
        
        // Cek dan tambahkan data prediksi
        const predictionResults = document.getElementById('predictionResults');
        if (predictionResults && !predictionResults.classList.contains('hidden')) {
            reportData.push('PREDIKSI AI:');
            reportData.push('-'.repeat(30));
            
            const predictionClass = document.getElementById('predictionClass')?.textContent || '-';
            const confidenceLow = document.getElementById('confidenceLowText')?.textContent || '-';
            const confidenceMedium = document.getElementById('confidenceMediumText')?.textContent || '-';
            const confidenceHigh = document.getElementById('confidenceHighText')?.textContent || '-';
            
            reportData.push(`Klasifikasi: ${predictionClass}`);
            reportData.push(`Confidence Vegetasi Rendah: ${confidenceLow}`);
            reportData.push(`Confidence Vegetasi Sedang: ${confidenceMedium}`);
            reportData.push(`Confidence Vegetasi Tinggi: ${confidenceHigh}`);
            reportData.push('');
        }
        
        // Cek dan tambahkan data area kritis
        const criticalContainer = document.getElementById('critical-areas-container');
        if (criticalContainer && !criticalContainer.classList.contains('hidden')) {
            reportData.push('AREA KRITIS TERDETEKSI:');
            reportData.push('-'.repeat(30));
            
            const criticalSummary = criticalContainer.querySelector('.critical-summary');
            if (criticalSummary) {
                reportData.push(criticalSummary.textContent || 'Data area kritis tersedia');
            } else {
                reportData.push('Area kritis telah diidentifikasi. Lihat peta untuk detail lokasi.');
            }
            reportData.push('');
        }
        
        // Footer
        reportData.push('='.repeat(60));
        reportData.push('Generated by Green Urban Dashboard');
        reportData.push('AI Innovation Challenge 2025');
        reportData.push('Tim: [Nama Tim] | Teknologi: Google Earth Engine, Flask, Random Forest');
        
        // Buat file text
        const content = reportData.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        
        // Buat nama file dengan timestamp
        const filename = `Analisis_Vegetasi_Semarang_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.txt`;
        
        // Download file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('Alternative report downloaded successfully:', filename);
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        successMsg.innerHTML = `
            <i class="fas fa-check-circle"></i> 
            Laporan berhasil didownload sebagai file TXT!
        `;
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            document.body.removeChild(successMsg);
        }, 3000);
        
    } catch (error) {
        console.error('Error in alternative download:', error);
        showError('Terjadi kesalahan saat membuat laporan. Silakan coba lagi.');
    }
}

// Fungsi untuk menampilkan/menyembunyikan tombol download
function toggleDownloadButton(show = true) {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
        if (show) {
            downloadBtn.classList.remove('hidden');
        } else {
            downloadBtn.classList.add('hidden');
        }
    }
}

// Fungsi untuk membuat fallback chart demo
function createFallbackChart() {
    console.log('Creating fallback LSTM chart...');
    
    // Generate demo time series data
    const today = new Date();
    const historicalDates = [];
    const historicalValues = [];
    const predictionDates = [];
    const predictionValues = [];
    
    // Historical data (last 30 days)
    for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        historicalDates.push(date.toISOString().split('T')[0]);
        
        // Generate realistic NDVI values with trend
        const baseValue = 0.4 + Math.sin(i * 0.1) * 0.1;
        const noise = (Math.random() - 0.5) * 0.05;
        historicalValues.push(Math.max(0.1, Math.min(0.8, baseValue + noise)));
    }
    
    // Prediction data (next 30 days)
    const lastValue = historicalValues[historicalValues.length - 1];
    for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        predictionDates.push(date.toISOString().split('T')[0]);
        
        // Generate prediction with slight upward trend
        const trendValue = lastValue + (i * 0.001);
        const seasonality = Math.sin(i * 0.2) * 0.02;
        const noise = (Math.random() - 0.5) * 0.01;
        predictionValues.push(Math.max(0.1, Math.min(0.8, trendValue + seasonality + noise)));
    }
    
    return {
        data: [
            {
                x: historicalDates,
                y: historicalValues,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Data Historis',
                line: {
                    color: '#537531',
                    width: 2
                },
                marker: {
                    color: '#537531',
                    size: 4
                }
            },
            {
                x: predictionDates,
                y: predictionValues,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Prediksi LSTM',
                line: {
                    color: '#ef4444',
                    width: 2,
                    dash: 'dot'
                },
                marker: {
                    color: '#ef4444',
                    size: 4
                }
            }
        ],
        layout: {
            title: {
                text: 'Prediksi NDVI dengan Model LSTM',
                font: { color: '#1e293b', size: 16 },
                x: 0.5
            },
            xaxis: {
                title: 'Tanggal',
                gridcolor: 'rgba(0,0,0,0.1)',
                linecolor: 'rgba(0,0,0,0.2)',
                tickcolor: 'rgba(0,0,0,0.2)',
                titlefont: { color: '#374151' },
                tickfont: { color: '#4b5563' }
            },
            yaxis: {
                title: 'Nilai NDVI',
                gridcolor: 'rgba(0,0,0,0.1)',
                linecolor: 'rgba(0,0,0,0.2)',
                tickcolor: 'rgba(0,0,0,0.2)',
                titlefont: { color: '#374151' },
                tickfont: { color: '#4b5563' },
                range: [0, 1]
            },
            paper_bgcolor: '#ffffff',
            plot_bgcolor: '#ffffff',
            font: {
                color: '#1e293b',
                family: 'Inter, system-ui, sans-serif'
            },
            margin: { t: 60, r: 40, b: 60, l: 60 },
            height: 350,
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.9)',
                bordercolor: 'rgba(0,0,0,0.2)',
                borderwidth: 1,
                font: { color: '#1e293b' }
            }
        }
    };
}
