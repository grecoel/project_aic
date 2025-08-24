@echo off
echo Starting Green Urban Dashboard Backend for Semarang...
echo.

REM Pindah ke direktori backend
cd /d "%~dp0"

REM Aktifkan virtual environment jika ada
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Install dependencies jika belum
echo Checking dependencies...
pip install -r requirements.txt

echo.
echo Starting Flask server...
echo Dashboard akan tersedia di: http://localhost:8080
echo Tekan Ctrl+C untuk menghentikan server
echo.

REM Jalankan Flask app
python app.py

pause
