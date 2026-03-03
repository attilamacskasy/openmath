$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pythonAppDir = Join-Path $repoRoot "python-app"
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonAppDir)) {
    Write-Error "python-app directory not found at: $pythonAppDir"
}

if (Test-Path -LiteralPath $venvPython) {
    $runCommand = "& '$venvPython' 'src/main.py'"
}
else {
    $runCommand = "python 'src/main.py'"
}

Start-Process -FilePath "powershell.exe" `
    -WorkingDirectory $pythonAppDir `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $runCommand
