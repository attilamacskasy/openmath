param(
  [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$SkipEnv
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path $RootPath).Path
$envFile = Join-Path $root ".env"
$migrationsDir = Join-Path $root "db\migrations"

function Import-DotEnv {
  param([string]$FilePath)

  Get-Content -Path $FilePath | ForEach-Object {
    $line = $_.Trim()

    if ([string]::IsNullOrWhiteSpace($line)) {
      return
    }

    if ($line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")

    if (-not [string]::IsNullOrWhiteSpace($name)) {
      [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

if (-not $SkipEnv -and (Test-Path $envFile)) {
  Write-Host "Loading environment from $envFile"
  Import-DotEnv -FilePath $envFile
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error "psql not found. Please install PostgreSQL client tools and ensure psql is in PATH."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  Write-Error "DATABASE_URL is not set. Add it to .env or current shell environment."
  exit 1
}

# Ensure psql uses UTF-8 so Unicode characters (≤, ≥, −, …) are preserved
[System.Environment]::SetEnvironmentVariable("PGCLIENTENCODING", "UTF8", "Process")

if (-not (Test-Path $migrationsDir)) {
  Write-Error "Migrations directory not found: $migrationsDir"
  exit 1
}

$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

if (-not $migrationFiles -or $migrationFiles.Count -eq 0) {
  Write-Host "No SQL migration files found in $migrationsDir"
  Write-Host "Reminder: restart Nuxt server after schema changes when applicable." -ForegroundColor Yellow
  exit 0
}

foreach ($file in $migrationFiles) {
  Write-Host "Applying $($file.FullName)"

  & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $file.FullName

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed applying migration: $($file.Name)"
    exit $LASTEXITCODE
  }
}

Write-Host "Migrations applied successfully." -ForegroundColor Green
Write-Host "Reminder: restart Nuxt server to pick up database and API schema changes." -ForegroundColor Yellow
