@echo off

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing packages...
pip install -r requirements.txt

echo Starting FoodGuard AI Service on port 8000...
python main.py
