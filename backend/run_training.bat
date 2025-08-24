@echo off
echo Menjalankan training model Random Forest...
echo.

cd /d "d:\College\Compfest - AIC\project_aic\green-urban-dashboard\backend"

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Training model...
python train_model.py

echo.
echo Training selesai!
pause
