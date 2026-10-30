@echo off
rem FoodGuard agent runner. Works from any folder.
rem   agent.cmd order 60006
chcp 65001 >nul
cd /d "%~dp0"
python -m fgagent %*
