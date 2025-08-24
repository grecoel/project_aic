@echo off
echo Menjalankan Green Urban Dashboard...
echo.

cd /d "d:\College\Compfest - AIC\project_aic\green-urban-dashboard\backend"

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting Flask application...
echo Backend akan berjalan di: http://localhost:8080
echo Frontend bisa diakses melalui file: ../frontend/index.html
echo.

python app.py
