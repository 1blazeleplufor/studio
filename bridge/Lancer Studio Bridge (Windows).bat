@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
%PY% --version >nul 2>nul || (echo Python 3 n'est pas installe. Installez-le depuis https://www.python.org/downloads/ en cochant "Add python.exe to PATH". & pause & exit /b 1)
if not exist .venv\Scripts\python.exe (
  echo Premiere installation de Studio Bridge, 1 a 2 minutes...
  %PY% -m venv .venv && .venv\Scripts\python -m pip install --upgrade pip && .venv\Scripts\python -m pip install -r requirements.txt || (echo Echec de l'installation & rmdir /s /q .venv & pause & exit /b 1)
)
.venv\Scripts\python studio_bridge.py
pause
