@echo off
cd /d "%~dp0"
call npm run clean
call npm run dev
