@echo off
REM Xem thu website tren may: mo http://localhost:8080
cd /d "%~dp0"
start "" http://localhost:8080

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8080
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080
  goto :eof
)
echo Chua cai Python. Cai Python tu python.org, hoac dung: npx serve
pause
