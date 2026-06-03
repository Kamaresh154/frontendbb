# Start Kidzventure dev stack (Windows PowerShell)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$root\.env")) {
  Copy-Item "$root\.env.example" "$root\.env"
  Write-Host "Created .env from .env.example"
}

# Try Docker Postgres
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Push-Location "$root\infra"
  docker compose up -d db
  Pop-Location
  Write-Host "Waiting for PostgreSQL..."
  Start-Sleep -Seconds 5
} else {
  Write-Host "Docker not found — ensure PostgreSQL is running on localhost:5432"
}

Push-Location "$root\backend"
& .\.venv\Scripts\alembic.exe upgrade head
& .\.venv\Scripts\python.exe -m scripts.seed_dev
Pop-Location

Write-Host "Starting API on http://localhost:8000"
Start-Process -FilePath "$root\backend\.venv\Scripts\uvicorn.exe" `
  -ArgumentList "app.main:app","--reload","--host","0.0.0.0","--port","8000" `
  -WorkingDirectory "$root\backend" -WindowStyle Minimized

Push-Location $root
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  if (-not (Test-Path "$root\node_modules")) { pnpm install }
  Write-Host "Starting admin web on http://localhost:5173"
  Start-Process pnpm -ArgumentList "dev:admin" -WorkingDirectory $root
}
Pop-Location

Write-Host "Done. API docs: http://localhost:8000/docs"
