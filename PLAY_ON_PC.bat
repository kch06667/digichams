@echo off
setlocal
cd /d "%~dp0"

rem Play the actual PC game. All private sprites stay on this computer.
where py >nul 2>nul
if errorlevel 1 goto missing_python
py -3 -c "from PIL import Image" >nul 2>nul
if errorlevel 1 goto missing_pillow

echo Starting the local Digimon Championship game...
echo Close this window to stop the local game server.
py -3 tools\play_local.py
if errorlevel 1 goto failed
exit /b 0

:missing_python
echo Python launcher "py" is unavailable.
echo Install Python 3 for Windows, then try again.
goto failed

:missing_pillow
echo Pillow is required for the private 216-species sprite conversion.
echo Open a command prompt and run: py -3 -m pip install Pillow
goto failed

:failed
echo.
echo The game did not start. Your browser save was not reset.
pause
exit /b 1
