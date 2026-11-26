@echo off
cd /d "%~dp0"
git init -b main
git add -A
git commit -m "BeatOk Studio: online beat studio"
git remote remove origin 2>nul
git remote add origin https://github.com/leaders-tech/beatok.git
git push -u origin main --force
pause
