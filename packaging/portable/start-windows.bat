@echo off
rem Портативный запуск «Ширмы мастера» на Windows: локальный сервер + браузер.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
