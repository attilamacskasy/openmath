param(
    [Parameter(Position = 0)]
    [string]$Mode = "menu",
    [switch]$AutoApprove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════════════════════
# Global State
# ═══════════════════════════════════════════════════════════

$script:RepoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$script:RunId = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$script:RunLogDir = Join-Path $script:RepoRoot ".dev-assistant\logs\$script:RunId"
$script:RunLogPath = Join-Path $script:RunLogDir "run.log"
$script:ErrorLogPath = Join-Path $script:RunLogDir "errors.log"
$script:SummaryPath = Join-Path $script:RunLogDir "summary.json"
$script:StateDir = Join-Path $script:RepoRoot ".dev-assistant\state"
$script:NuxtPidPath = Join-Path $script:StateDir "nuxt-dev.pid"
$script:FastApiPidPath = Join-Path $script:StateDir "fastapi-dev.pid"
$script:AngularPidPath = Join-Path $script:StateDir "angular-dev.pid"
$script:RemoteConfigPath = Join-Path $script:StateDir "remote.json"
$script:CompactLogMode = $false
$script:StepResults = New-Object System.Collections.Generic.List[object]
$script:DetectedSignatures = New-Object System.Collections.Generic.List[string]
$script:StartAt = Get-Date
$script:CurrentMode = $Mode
$script:ShellExe = if ($PSVersionTable.PSEdition -eq "Core") { "pwsh" } else { "powershell" }
$script:LastLogLines = New-Object System.Collections.Generic.List[string]
$script:AutoApproveEnabled = [bool]$AutoApprove

New-Item -ItemType Directory -Force -Path $script:RunLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $script:StateDir | Out-Null
New-Item -ItemType File -Force -Path $script:RunLogPath | Out-Null
New-Item -ItemType File -Force -Path $script:ErrorLogPath | Out-Null

# ═══════════════════════════════════════════════════════════
# Core Infrastructure (Logging, Steps, Flows)
# ═══════════════════════════════════════════════════════════

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS", "STEP", "HEARTBEAT")]
        [string]$Level = "INFO",
        [string]$StepLabel = "SYSTEM"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp][$StepLabel][$Level] $Message"
    Add-Content -Path $script:RunLogPath -Value $line

    $script:LastLogLines.Add($line)
    if ($script:LastLogLines.Count -gt 300) {
        $script:LastLogLines.RemoveAt(0)
    }

    if ($Level -eq "ERROR") {
        Add-Content -Path $script:ErrorLogPath -Value $line
    }

    if ($script:CompactLogMode -and $Level -eq "INFO") {
        return
    }

    $originalColor = $Host.UI.RawUI.ForegroundColor
    switch ($Level) {
        "ERROR" { $Host.UI.RawUI.ForegroundColor = "Red" }
        "WARN" { $Host.UI.RawUI.ForegroundColor = "Yellow" }
        "SUCCESS" { $Host.UI.RawUI.ForegroundColor = "Green" }
        "STEP" { $Host.UI.RawUI.ForegroundColor = "Cyan" }
        "HEARTBEAT" { $Host.UI.RawUI.ForegroundColor = "DarkYellow" }
        default { }
    }

    Write-Host $line
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Add-Signature {
    param([string]$Signature)
    if ([string]::IsNullOrWhiteSpace($Signature)) { return }
    if (-not $script:DetectedSignatures.Contains($Signature)) {
        $script:DetectedSignatures.Add($Signature)
    }
}

function Save-Summary {
    try {
        $endAt = Get-Date
        $startAt = [datetime]$script:StartAt
        $duration = [math]::Round(([timespan]($endAt - $startAt)).TotalSeconds, 2)

        $osCaption = "unknown"
        try {
            $osCaption = (Get-CimInstance Win32_OperatingSystem).Caption
        }
        catch {
            $osCaption = [System.Environment]::OSVersion.VersionString
        }

        $stepArray = @()
        foreach ($step in $script:StepResults) {
            $stepArray += [pscustomobject]$step
        }

        $summary = [pscustomobject]@{
            runId = $script:RunId
            mode = $script:CurrentMode
            host = [pscustomobject]@{
                machine = $env:COMPUTERNAME
                user = $env:USERNAME
                shell = $script:ShellExe
                psVersion = $PSVersionTable.PSVersion.ToString()
                os = $osCaption
            }
            startAt = $startAt.ToString("o")
            endAt = $endAt.ToString("o")
            durationSeconds = $duration
            logDir = $script:RunLogDir
            runLog = $script:RunLogPath
            errorLog = $script:ErrorLogPath
            steps = $stepArray
            signatures = @($script:DetectedSignatures)
        }

        $summary | ConvertTo-Json -Depth 10 | Set-Content -Path $script:SummaryPath -Encoding UTF8
    }
    catch {
        Add-Content -Path $script:RunLogPath -Value ("[{0}][SUMMARY][ERROR] Failed to write summary: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $_.Exception.Message)
    }
}

function Show-Tail {
    param([int]$Lines = 200)

    Write-Log -Level "STEP" -StepLabel "TAIL" -Message "Showing last $Lines log lines"
    $tail = $script:LastLogLines | Select-Object -Last $Lines
    foreach ($line in $tail) {
        Write-Host $line
    }
}

function Confirm-StepAction {
    param(
        [Parameter(Mandatory = $true)][string]$StepLabel,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Reason,
        [Parameter(Mandatory = $true)][string]$ExpectedOutput
    )

    Write-Host ""
    Write-Host "==[$StepLabel]==" -ForegroundColor Cyan
    Write-Host "Command: $Command"
    Write-Host "Working directory: $WorkingDirectory"
    Write-Host "Reason: $Reason"
    Write-Host "Expected: $ExpectedOutput"

    if ($AutoApprove) {
        Write-Log -Level "INFO" -StepLabel $StepLabel -Message "AutoApprove enabled. Running step automatically."
        return @{ action = "run"; command = $Command }
    }

    while ($true) {
        $choice = Read-Host "[R]un  [S]kip  [E]dit  [A]bort"
        switch ($choice.ToLowerInvariant()) {
            "r" { return @{ action = "run"; command = $Command } }
            "s" { return @{ action = "skip"; command = $Command } }
            "a" { return @{ action = "abort"; command = $Command } }
            "e" {
                $edited = Read-Host "Enter edited command"
                if (-not [string]::IsNullOrWhiteSpace($edited)) {
                    return @{ action = "run"; command = $edited; edited = $true; original = $Command }
                }
            }
            default { Write-Host "Please choose R, S, E, or A." -ForegroundColor Yellow }
        }
    }
}

function Start-LoggedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$StepLabel,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    $startTime = Get-Date
    $firstErrorLine = $null
    $exitCode = 0

    try {
        Push-Location $WorkingDirectory

        $global:LASTEXITCODE = 0
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        & cmd.exe /d /c "$Command" 2>&1 | ForEach-Object {
            $line = $_.ToString()
            if ([string]::IsNullOrWhiteSpace($line)) {
                return
            }
            $level = "INFO"

            if ($level -eq "ERROR" -and -not $firstErrorLine) {
                $firstErrorLine = $line
            }

            if ($line -match "Ignored build scripts") { Add-Signature "pnpm:ignored-build-scripts" }
            if ($line -match "Components directory not found") { Add-Signature "nuxt:components-directory-not-found" }
            if ($line -match "DATABASE_URL") { Add-Signature "env:database-url-mentioned" }
            if ($line -match "address already in use|EADDRINUSE") { Add-Signature "port:in-use" }

            Write-Log -Level $level -StepLabel $StepLabel -Message $line
        }

        $exitCode = $global:LASTEXITCODE
        if ($null -eq $exitCode -or ($exitCode -isnot [int])) {
            $exitCode = 0
        }

        $ErrorActionPreference = $previousErrorActionPreference
    }
    catch {
        $exitCode = 1
        $line = $_.Exception.Message
        if (-not $firstErrorLine) {
            $firstErrorLine = $line
        }
        Write-Log -Level "ERROR" -StepLabel $StepLabel -Message $line
    }
    finally {
        try {
            if ($previousErrorActionPreference) {
                $ErrorActionPreference = $previousErrorActionPreference
            }
        }
        catch { }
        try { Pop-Location } catch { }
    }

    $duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)

    return [ordered]@{
        exitCode = [int]$exitCode
        durationSeconds = $duration
        firstErrorLine = $firstErrorLine
    }
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][int]$Index,
        [Parameter(Mandatory = $true)][int]$Total,
        [Parameter(Mandatory = $true)][string]$FlowLabel,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Reason,
        [Parameter(Mandatory = $true)][string]$ExpectedOutput,
        [bool]$Required = $true,
        [bool]$SkipInAutoApprove = $false
    )

    $stepLabel = "STEP $Index/$Total][$FlowLabel"
    Write-Host ""
    Write-Host "==[STEP $Index/$Total][$FlowLabel] $Name ($Command) @ $WorkingDirectory==" -ForegroundColor Cyan

    if ($AutoApprove -and $SkipInAutoApprove) {
        Write-Log -Level "WARN" -StepLabel $stepLabel -Message "AutoApprove: skipping interactive step '$Name'."
        Write-Log -Level "INFO" -StepLabel $stepLabel -Message "Reason: this command requires terminal interaction and can block unattended runs."

        $script:StepResults.Add([ordered]@{
            label = $stepLabel
            name = $Name
            command = $Command
            cwd = $WorkingDirectory
            status = "skipped"
            durationSeconds = 0
            exitCode = $null
            note = "Skipped interactive step in AutoApprove mode"
        }) | Out-Null

        return [ordered]@{ ok = $true; skipped = $true; autoSkippedInteractive = $true }
    }

    $decision = Confirm-StepAction -StepLabel $stepLabel -Command $Command -WorkingDirectory $WorkingDirectory -Reason $Reason -ExpectedOutput $ExpectedOutput
    $editedCommand = $decision.command

    if ($decision.action -eq "abort") {
        $script:StepResults.Add([ordered]@{
            label = $stepLabel
            name = $Name
            command = $Command
            cwd = $WorkingDirectory
            status = "aborted"
            durationSeconds = 0
            exitCode = $null
        }) | Out-Null
        throw "User aborted at $Name"
    }

    if ($decision.action -eq "skip") {
        Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Skipped by user."
        $script:StepResults.Add([ordered]@{
            label = $stepLabel
            name = $Name
            command = $Command
            cwd = $WorkingDirectory
            status = "skipped"
            durationSeconds = 0
            exitCode = $null
        }) | Out-Null

        if ($Required) {
            Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Required step skipped."
        }

        return [ordered]@{ ok = -not $Required; skipped = $true }
    }

    if ($decision.ContainsKey("edited") -and $decision.edited) {
        Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Command edited by user."
        Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Original: $($decision.original)"
        Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Edited:   $editedCommand"
    }

    $result = Start-LoggedProcess -StepLabel $stepLabel -Command $editedCommand -WorkingDirectory $WorkingDirectory

    $status = if ($result.exitCode -eq 0) { "passed" } else { "failed" }
    $icon = if ($status -eq "passed") { "✅" } else { "❌" }
    Write-Log -Level $(if ($status -eq "passed") { "SUCCESS" } else { "ERROR" }) -StepLabel $stepLabel -Message "$icon $Name finished with exit code $($result.exitCode)"

    $script:StepResults.Add([ordered]@{
        label = $stepLabel
        name = $Name
        command = $editedCommand
        cwd = $WorkingDirectory
        status = $status
        durationSeconds = $result.durationSeconds
        exitCode = $result.exitCode
        firstErrorLine = $result.firstErrorLine
    }) | Out-Null

    if ($status -eq "failed") {
        Write-Host ""
        Write-Host "❌ FAILURE SUMMARY" -ForegroundColor Red
        Write-Host "Step: $Name"
        Write-Host "Command: $editedCommand"
        Write-Host "Exit code: $($result.exitCode)"
        if ($result.firstErrorLine) {
            Write-Host "First error: $($result.firstErrorLine)"
        }
        Show-Tail -Lines 200

        while ($true) {
            if ($AutoApprove) {
                if ($Required) {
                    return [ordered]@{ ok = $false; failed = $true; action = "abort" }
                }
                Write-Log -Level "WARN" -StepLabel $stepLabel -Message "Optional step failed under AutoApprove; continuing flow."
                return [ordered]@{ ok = $true; failed = $true; action = "skip-optional" }
            }
            $choice = Read-Host "[R]etry step  [E]dit command  [S]kip  [A]bort"
            switch ($choice.ToLowerInvariant()) {
                "r" { return (Invoke-Step -Index $Index -Total $Total -FlowLabel $FlowLabel -Name $Name -Command $Command -WorkingDirectory $WorkingDirectory -Reason $Reason -ExpectedOutput $ExpectedOutput -Required:$Required) }
                "e" {
                    $newCommand = Read-Host "New command"
                    if (-not [string]::IsNullOrWhiteSpace($newCommand)) {
                        return (Invoke-Step -Index $Index -Total $Total -FlowLabel $FlowLabel -Name $Name -Command $newCommand -WorkingDirectory $WorkingDirectory -Reason $Reason -ExpectedOutput $ExpectedOutput -Required:$Required)
                    }
                }
                "s" { return [ordered]@{ ok = -not $Required; skipped = $true; failed = $true; action = "skip" } }
                "a" { return [ordered]@{ ok = $false; failed = $true; action = "abort" } }
                default { Write-Host "Please choose R, E, S, or A." -ForegroundColor Yellow }
            }
        }
    }

    return [ordered]@{ ok = $true; skipped = $false }
}

function Invoke-Flow {
    param(
        [Parameter(Mandatory = $true)][string]$FlowLabel,
        [Parameter(Mandatory = $true)][array]$Steps
    )

    for ($i = 0; $i -lt $Steps.Count; $i++) {
        $step = $Steps[$i]
        $skipInAutoApprove = $false
        if ($step -is [System.Collections.IDictionary]) {
            if ($step.Contains("skipInAutoApprove")) {
                $skipInAutoApprove = [bool]$step["skipInAutoApprove"]
            }
        }

        $result = Invoke-Step -Index ($i + 1) -Total $Steps.Count -FlowLabel $FlowLabel -Name $step.name -Command $step.command -WorkingDirectory $step.cwd -Reason $step.reason -ExpectedOutput $step.expected -Required:([bool]$step.required) -SkipInAutoApprove:$skipInAutoApprove
        if (-not $result.ok) {
            throw "Flow $FlowLabel stopped at step $($step.name)."
        }
    }

    Write-Log -Level "SUCCESS" -StepLabel $FlowLabel -Message "✅ Flow completed successfully."
}

# ═══════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════

function Test-CommandExists {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

function Test-PortOpen {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(500, $false)
        if ($success) {
            $client.EndConnect($iar) | Out-Null
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Get-CommandVersion {
    param([string]$Executable, [string]$ArgumentLine = "--version")
    try {
        $output = & $Executable $ArgumentLine 2>&1
        return (($output | Select-Object -First 1) -join "")
    }
    catch {
        return "unknown"
    }
}

function Get-PackageManager {
    if (Test-CommandExists -Name "pnpm") {
        return "pnpm"
    }

    if (-not (Test-CommandExists -Name "npm")) {
        throw "Neither pnpm nor npm is available."
    }

    if ($AutoApprove) {
        throw "pnpm not found and AutoApprove is enabled. Explicit fallback confirmation required."
    }

    $choice = Read-Host "pnpm not found. Use npm for this run? [y/N]"
    if ($choice.ToLowerInvariant() -eq "y") {
        Write-Log -Level "WARN" -StepLabel "PM" -Message "User confirmed fallback to npm for this run."
        return "npm"
    }

    throw "pnpm missing and npm fallback not approved."
}

function Get-DevProcessByPidFile {
    param([string]$PidPath)
    if (-not (Test-Path $PidPath)) { return $null }
    try {
        $pidValue = Get-Content -Path $PidPath -ErrorAction Stop | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($pidValue)) { return $null }
        $id = [int]$pidValue
        return Get-Process -Id $id -ErrorAction SilentlyContinue
    } catch { return $null }
}

function Show-ComponentStatus {
    param(
        [string]$Label,
        [string]$PidPath,
        [string]$Endpoint,
        [string]$ComponentType = "process"
    )

    Write-Host ""
    Write-Host "═══ $Label ═══" -ForegroundColor Cyan

    if ($ComponentType -eq "docker") {
        try {
            $containerStatus = docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>&1
            $containerStatus | ForEach-Object { Write-Host "  $_" }
        } catch {
            Write-Host "  Status: Docker not available" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  Endpoint:  $Endpoint"
        Write-Host ""
        Write-Host "  Recent logs:" -ForegroundColor DarkGray
        try {
            docker compose logs --tail=15 postgres 2>&1 | ForEach-Object { Write-Host "    $_" }
        } catch {
            Write-Host "    (unable to fetch logs)" -ForegroundColor Yellow
        }
    }
    else {
        $proc = Get-DevProcessByPidFile -PidPath $PidPath
        if ($proc) {
            Write-Host "  Status:    ● Running (PID $($proc.Id))" -ForegroundColor Green
        }
        else {
            Write-Host "  Status:    ○ Stopped" -ForegroundColor DarkGray
        }
        Write-Host "  Endpoint:  $Endpoint"
    }
    Write-Host ""
}

function Show-NotImplemented {
    param([string]$Name, [string]$SpecRef)
    Write-Host ""
    Write-Host "  ⚠ $Name is not yet implemented." -ForegroundColor Yellow
    Write-Host "  See $SpecRef for details." -ForegroundColor DarkGray
    Write-Host ""
}

function Open-LatestLog {
    $base = Join-Path $script:RepoRoot ".dev-assistant\logs"
    if (-not (Test-Path $base)) {
        Write-Log -Level "WARN" -StepLabel "LOGS" -Message "No logs directory found yet."
        return
    }

    $latest = Get-ChildItem -Path $base -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Log -Level "WARN" -StepLabel "LOGS" -Message "No run folders found."
        return
    }

    $file = Join-Path $latest.FullName "run.log"
    if (Test-Path $file) {
        Start-Process notepad.exe $file
        Write-Log -Level "INFO" -StepLabel "LOGS" -Message "Opened $file"
    }
}

# ═══════════════════════════════════════════════════════════
# Check Requirements (replaces old Doctor)
# ═══════════════════════════════════════════════════════════

function Invoke-CheckRequirements {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Check Requirements — Verifying all prerequisites" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    $label = "REQS"

    $checks = @(
        @{ name = "node";   hint = "Install Node.js LTS from https://nodejs.org" },
        @{ name = "pnpm";   hint = "Run: npm install -g pnpm" },
        @{ name = "docker"; hint = "Install Docker Desktop from https://docker.com" },
        @{ name = "git";    hint = "Install Git from https://git-scm.com" },
        @{ name = "python"; hint = "Install Python 3.12+ from https://python.org" },
        @{ name = "psql";   hint = "Install PostgreSQL client tools (psql)" },
        @{ name = "ssh";    hint = "SSH client (built-in on Win10+)" }
    )

    foreach ($check in $checks) {
        if (Test-CommandExists -Name $check.name) {
            $version = Get-CommandVersion -Executable $check.name
            Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ $($check.name) found ($version)"
        }
        else {
            Write-Log -Level "ERROR" -StepLabel $label -Message "❌ $($check.name) missing. Hint: $($check.hint)"
        }
    }

    # Docker Compose V2
    if (Test-CommandExists -Name "docker") {
        try {
            $composeVersion = docker compose version 2>&1
            Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ docker compose available ($($composeVersion | Select-Object -First 1))"
        }
        catch {
            Write-Log -Level "ERROR" -StepLabel $label -Message "❌ docker compose unavailable. Ensure Docker Desktop Compose V2 is enabled."
        }
    }

    # pip
    if (Test-CommandExists -Name "python") {
        try {
            $pipVersion = python -m pip --version 2>&1
            Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ pip available ($($pipVersion | Select-Object -First 1))"
        }
        catch {
            Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ pip not available via python -m pip"
        }
    }

    # Project files
    $paths = @(
        @{ path = "docker-compose.yml"; hint = "Create root docker-compose.yml" },
        @{ path = "python-api\requirements.txt"; hint = "Backend requirements file" },
        @{ path = "angular-app\package.json"; hint = "Angular frontend" },
        @{ path = "nuxt-app\package.json"; hint = "Nuxt frontend" }
    )

    foreach ($item in $paths) {
        $fullPath = Join-Path $script:RepoRoot $item.path
        if (Test-Path $fullPath) {
            Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ found $($item.path)"
        }
        else {
            Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ missing $($item.path) — $($item.hint)"
        }
    }

    # .env
    $rootEnv = Join-Path $script:RepoRoot ".env"
    if (Test-Path $rootEnv) {
        $envText = Get-Content -Raw -Path $rootEnv
        if ($envText -match "DATABASE_URL\s*=") {
            Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ .env has DATABASE_URL"
        }
        else {
            Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ .env missing DATABASE_URL"
        }
    }
    else {
        Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ .env not found — copy .env.example and configure"
    }

    # .venv
    $venvPython = Join-Path $script:RepoRoot ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        Write-Log -Level "SUCCESS" -StepLabel $label -Message "✅ Python venv found at .venv"
    }
    else {
        Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ Python venv not found. Create with: python -m venv .venv"
    }

    # Ports
    foreach ($portInfo in @(
        @{ port = 5432;  name = "PostgreSQL" },
        @{ port = 8000;  name = "FastAPI" },
        @{ port = 8080;  name = "Adminer" },
        @{ port = 4200;  name = "Angular" },
        @{ port = 3000;  name = "Nuxt" }
    )) {
        $isOpen = Test-PortOpen -Port $portInfo.port
        $state = if ($isOpen) { "in use" } else { "free" }
        $level = if ($isOpen) { "WARN" } else { "INFO" }
        Write-Log -Level $level -StepLabel $label -Message "Port $($portInfo.port) ($($portInfo.name)) is $state"
    }

    if ($script:RepoRoot -match "OneDrive") {
        Write-Log -Level "WARN" -StepLabel $label -Message "⚠️ Repo appears under OneDrive path. This may slow Node installs/builds."
    }

    Write-Host ""
}

# ═══════════════════════════════════════════════════════════
# Database 1 — Docker / PostgreSQL
# ═══════════════════════════════════════════════════════════

function Invoke-DbInit {
    Write-Log -Level "STEP" -StepLabel "DB-INIT" -Message "Checking database prerequisites..."

    if (-not (Test-CommandExists -Name "docker")) {
        Write-Log -Level "ERROR" -StepLabel "DB-INIT" -Message "❌ Docker not installed. Install Docker Desktop first."
        return
    }
    Write-Log -Level "SUCCESS" -StepLabel "DB-INIT" -Message "✅ Docker found"

    $envFile = Join-Path $script:RepoRoot ".env"
    if (-not (Test-Path $envFile)) {
        Write-Log -Level "WARN" -StepLabel "DB-INIT" -Message "⚠️ .env not found. Creating from defaults..."
        $defaultEnv = @"
DATABASE_URL=postgresql+asyncpg://quiz:quiz@localhost:5432/quiz
POSTGRES_USER=quiz
POSTGRES_PASSWORD=quiz
POSTGRES_DB=quiz
"@
        Set-Content -Path $envFile -Value $defaultEnv -Encoding UTF8
        Write-Log -Level "SUCCESS" -StepLabel "DB-INIT" -Message "✅ Created .env with default database settings"
    }
    else {
        Write-Log -Level "SUCCESS" -StepLabel "DB-INIT" -Message "✅ .env exists"
    }

    Write-Log -Level "SUCCESS" -StepLabel "DB-INIT" -Message "✅ Database init complete"
}

function Invoke-DbBuild {
    Invoke-Flow -FlowLabel "DB-BUILD" -Steps @(
        @{ name = "Docker Compose Build"; command = "docker compose build"; cwd = $script:RepoRoot; reason = "Build/pull database container images."; expected = "Images pulled/built successfully."; required = $true }
    )
}

function Invoke-DbStart {
    Invoke-Flow -FlowLabel "DB-START" -Steps @(
        @{ name = "DB Start"; command = "docker compose up -d"; cwd = $script:RepoRoot; reason = "Start PostgreSQL and Adminer containers."; expected = "Containers running."; required = $true }
    )
}

function Invoke-DbMigrations {
    $migrationScript = Join-Path $script:RepoRoot "scripts\apply-migrations.ps1"
    if (-not (Test-Path $migrationScript)) {
        throw "Migration script not found: $migrationScript"
    }

    Invoke-Flow -FlowLabel "DB-MIGRATE" -Steps @(
        @{
            name = "Apply DB Migrations"
            command = "$script:ShellExe -NoProfile -ExecutionPolicy Bypass -File `"$migrationScript`""
            cwd = $script:RepoRoot
            reason = "Apply SQL migrations."
            expected = "All migration files apply successfully."
            required = $true
        }
    )
}

function Invoke-DbStop {
    Invoke-Flow -FlowLabel "DB-STOP" -Steps @(
        @{ name = "DB Stop"; command = "docker compose down"; cwd = $script:RepoRoot; reason = "Stop database containers."; expected = "Containers stopped."; required = $true }
    )
}

function Invoke-DbStatus {
    Show-ComponentStatus -Label "Database 1 (PostgreSQL)" -Endpoint "localhost:5432 (DB) / localhost:8080 (Adminer)" -ComponentType "docker"
}

# ═══════════════════════════════════════════════════════════
# Backend 1 — Python FastAPI
# ═══════════════════════════════════════════════════════════

function Invoke-FastApiInit {
    $venvPath = Join-Path $script:RepoRoot ".venv"
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    $reqFile = Join-Path $script:RepoRoot "python-api\requirements.txt"

    if (-not (Test-Path $venvPython)) {
        Write-Log -Level "STEP" -StepLabel "FASTAPI-INIT" -Message "Creating Python venv..."
        Invoke-Flow -FlowLabel "FASTAPI-VENV" -Steps @(
            @{ name = "Create venv"; command = "python -m venv .venv"; cwd = $script:RepoRoot; reason = "Create Python virtual environment."; expected = ".venv directory created."; required = $true }
        )
    }
    else {
        Write-Log -Level "SUCCESS" -StepLabel "FASTAPI-INIT" -Message "✅ Python venv already exists"
    }

    Invoke-Flow -FlowLabel "FASTAPI-INSTALL" -Steps @(
        @{ name = "Install dependencies"; command = "$venvPython -m pip install -r `"$reqFile`""; cwd = $script:RepoRoot; reason = "Install FastAPI + asyncpg dependencies."; expected = "All packages installed."; required = $true }
    )
}

function Start-FastApiServer {
    $existing = Get-DevProcessByPidFile -PidPath $script:FastApiPidPath
    if ($existing) {
        Write-Log -Level "WARN" -StepLabel "FASTAPI-START" -Message "FastAPI dev server already running (PID $($existing.Id))."
        return
    }

    $apiDir = Join-Path $script:RepoRoot "python-api"
    $venvPython = Join-Path $script:RepoRoot ".venv\Scripts\python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Log -Level "ERROR" -StepLabel "FASTAPI-START" -Message "Python venv not found. Run Backend Init first."
        return
    }

    $command = "Set-Location '$apiDir'; & '$venvPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    $proc = Start-Process -FilePath $script:ShellExe -ArgumentList @("-NoExit", "-Command", $command) -PassThru
    Set-Content -Path $script:FastApiPidPath -Value $proc.Id -Encoding ASCII

    Write-Log -Level "SUCCESS" -StepLabel "FASTAPI-START" -Message "✅ FastAPI started (PID $($proc.Id)) at http://localhost:8000"

    $script:StepResults.Add([ordered]@{
        label = "FASTAPI-START"; name = "FastAPI Start"; command = "uvicorn --reload --port 8000"
        cwd = $apiDir; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Stop-FastApiServer {
    $proc = Get-DevProcessByPidFile -PidPath $script:FastApiPidPath
    if (-not $proc) {
        if (Test-Path $script:FastApiPidPath) { Remove-Item -Path $script:FastApiPidPath -Force -ErrorAction SilentlyContinue }
        Write-Log -Level "WARN" -StepLabel "FASTAPI-STOP" -Message "FastAPI not running or already stopped."
        return
    }

    Stop-Process -Id $proc.Id -Force
    Remove-Item -Path $script:FastApiPidPath -Force -ErrorAction SilentlyContinue
    Write-Log -Level "SUCCESS" -StepLabel "FASTAPI-STOP" -Message "✅ FastAPI stopped (PID $($proc.Id))."

    $script:StepResults.Add([ordered]@{
        label = "FASTAPI-STOP"; name = "FastAPI Stop"; command = "Stop-Process"
        cwd = $script:RepoRoot; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Invoke-FastApiStatus {
    Show-ComponentStatus -Label "Backend 1 (Python FastAPI)" -PidPath $script:FastApiPidPath -Endpoint "http://localhost:8000 (API) / http://localhost:8000/docs (Swagger)"
}

# ═══════════════════════════════════════════════════════════
# Frontend 2 — Vue.js / Nuxt 4
# ═══════════════════════════════════════════════════════════

function Invoke-NuxtInit {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    $steps = @(
        @{ name = "Nuxt Install"; command = "$pm install"; cwd = $nuxtDir; reason = "Install dependencies."; expected = "Dependencies installed."; required = $true },
        @{ name = "Approve Builds"; command = "$pm approve-builds"; cwd = $nuxtDir; reason = "Approve blocked build scripts on Windows."; expected = "Approval complete."; required = $false; skipInAutoApprove = $true },
        @{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = $nuxtDir; reason = "Generate Nuxt types and artifacts."; expected = "Prepare completes."; required = $true }
    )

    Invoke-Flow -FlowLabel "NUXT-INIT" -Steps $steps
}

function Start-NuxtDevServer {
    $existing = Get-DevProcessByPidFile -PidPath $script:NuxtPidPath
    if ($existing) {
        Write-Log -Level "WARN" -StepLabel "NUXT-START" -Message "Nuxt dev server already running (PID $($existing.Id))."
        return
    }

    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"
    $command = "Set-Location '$nuxtDir'; $pm dev"

    $proc = Start-Process -FilePath $script:ShellExe -ArgumentList @("-NoExit", "-Command", $command) -PassThru
    Set-Content -Path $script:NuxtPidPath -Value $proc.Id -Encoding ASCII

    Write-Log -Level "SUCCESS" -StepLabel "NUXT-START" -Message "✅ Nuxt dev server started (PID $($proc.Id)) at http://localhost:3000"

    $script:StepResults.Add([ordered]@{
        label = "NUXT-START"; name = "Nuxt Start"; command = "$pm dev"
        cwd = $nuxtDir; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Stop-NuxtDevServer {
    $proc = Get-DevProcessByPidFile -PidPath $script:NuxtPidPath
    if (-not $proc) {
        if (Test-Path $script:NuxtPidPath) { Remove-Item -Path $script:NuxtPidPath -Force -ErrorAction SilentlyContinue }
        Write-Log -Level "WARN" -StepLabel "NUXT-STOP" -Message "Nuxt not running or already stopped."
        return
    }

    Stop-Process -Id $proc.Id -Force
    Remove-Item -Path $script:NuxtPidPath -Force -ErrorAction SilentlyContinue
    Write-Log -Level "SUCCESS" -StepLabel "NUXT-STOP" -Message "✅ Nuxt dev server stopped (PID $($proc.Id))."

    $script:StepResults.Add([ordered]@{
        label = "NUXT-STOP"; name = "Nuxt Stop"; command = "Stop-Process"
        cwd = $script:RepoRoot; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Invoke-NuxtValidate {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    Invoke-Flow -FlowLabel "NUXT-VALIDATE" -Steps @(
        @{ name = "Nuxt Typecheck"; command = "$pm nuxt typecheck"; cwd = $nuxtDir; reason = "Validate Nuxt project types."; expected = "Typecheck passes."; required = $true }
    )
}

function Invoke-NuxtBuild {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    Invoke-Flow -FlowLabel "NUXT-BUILD" -Steps @(
        @{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = $nuxtDir; reason = "Generate artifacts before build."; expected = "Prepare passes."; required = $true },
        @{ name = "Nuxt Build"; command = "$pm build"; cwd = $nuxtDir; reason = "Build production assets."; expected = "Build completes."; required = $true }
    )
}

function Invoke-NuxtStatus {
    Show-ComponentStatus -Label "Frontend 2 (Vue.js / Nuxt 4)" -PidPath $script:NuxtPidPath -Endpoint "http://localhost:3000"
}

# ═══════════════════════════════════════════════════════════
# Frontend 3 — Angular + PrimeNG
# ═══════════════════════════════════════════════════════════

function Invoke-AngularInit {
    $pm = Get-PackageManager
    $angularDir = Join-Path $script:RepoRoot "angular-app"

    Invoke-Flow -FlowLabel "ANGULAR-INIT" -Steps @(
        @{ name = "Angular Install"; command = "$pm install"; cwd = $angularDir; reason = "Install Angular + PrimeNG dependencies."; expected = "Dependencies installed."; required = $true }
    )
}

function Start-AngularDevServer {
    $existing = Get-DevProcessByPidFile -PidPath $script:AngularPidPath
    if ($existing) {
        Write-Log -Level "WARN" -StepLabel "ANGULAR-START" -Message "Angular dev server already running (PID $($existing.Id))."
        return
    }

    $pm = Get-PackageManager
    $angularDir = Join-Path $script:RepoRoot "angular-app"
    $command = "Set-Location '$angularDir'; $pm start"

    $proc = Start-Process -FilePath $script:ShellExe -ArgumentList @("-NoExit", "-Command", $command) -PassThru
    Set-Content -Path $script:AngularPidPath -Value $proc.Id -Encoding ASCII

    Write-Log -Level "SUCCESS" -StepLabel "ANGULAR-START" -Message "✅ Angular dev server started (PID $($proc.Id)) at http://localhost:4200"

    $script:StepResults.Add([ordered]@{
        label = "ANGULAR-START"; name = "Angular Start"; command = "$pm start"
        cwd = $angularDir; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Stop-AngularDevServer {
    $proc = Get-DevProcessByPidFile -PidPath $script:AngularPidPath
    if (-not $proc) {
        if (Test-Path $script:AngularPidPath) { Remove-Item -Path $script:AngularPidPath -Force -ErrorAction SilentlyContinue }
        Write-Log -Level "WARN" -StepLabel "ANGULAR-STOP" -Message "Angular not running or already stopped."
        return
    }

    Stop-Process -Id $proc.Id -Force
    Remove-Item -Path $script:AngularPidPath -Force -ErrorAction SilentlyContinue
    Write-Log -Level "SUCCESS" -StepLabel "ANGULAR-STOP" -Message "✅ Angular dev server stopped (PID $($proc.Id))."

    $script:StepResults.Add([ordered]@{
        label = "ANGULAR-STOP"; name = "Angular Stop"; command = "Stop-Process"
        cwd = $script:RepoRoot; status = "passed"; durationSeconds = 0; exitCode = 0
    }) | Out-Null
}

function Invoke-AngularBuild {
    $pm = Get-PackageManager
    $angularDir = Join-Path $script:RepoRoot "angular-app"

    Invoke-Flow -FlowLabel "ANGULAR-BUILD" -Steps @(
        @{ name = "Angular Install"; command = "$pm install"; cwd = $angularDir; reason = "Install dependencies."; expected = "Dependencies installed."; required = $false },
        @{ name = "Angular Build"; command = "$pm run build"; cwd = $angularDir; reason = "Build production assets."; expected = "Build completes."; required = $true }
    )
}

function Invoke-AngularStatus {
    Show-ComponentStatus -Label "Frontend 3 (Angular + PrimeNG)" -PidPath $script:AngularPidPath -Endpoint "http://localhost:4200"
}

# ═══════════════════════════════════════════════════════════
# Quick Start — DEV
# ═══════════════════════════════════════════════════════════

function Invoke-DevQuickStart {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  Quick Start Dev Stack" -ForegroundColor Green
    Write-Host "  Postgres + Python FastAPI + Angular/PrimeNG" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""

    $pm = Get-PackageManager
    $angularDir = Join-Path $script:RepoRoot "angular-app"
    $venvPython = Join-Path $script:RepoRoot ".venv\Scripts\python.exe"
    $reqFile = Join-Path $script:RepoRoot "python-api\requirements.txt"

    # Phase 1: Dependencies
    $steps = @(
        @{ name = "DB Start"; command = "docker compose up -d"; cwd = $script:RepoRoot; reason = "Start PostgreSQL + Adminer."; expected = "Containers running."; required = $true }
    )

    # Add venv creation if needed
    if (-not (Test-Path $venvPython)) {
        $steps += @{ name = "Create venv"; command = "python -m venv .venv"; cwd = $script:RepoRoot; reason = "Create Python virtual environment."; expected = ".venv created."; required = $true }
    }

    $steps += @(
        @{ name = "FastAPI Install"; command = "$venvPython -m pip install -r `"$reqFile`""; cwd = $script:RepoRoot; reason = "Install FastAPI dependencies."; expected = "Packages installed."; required = $true },
        @{ name = "Angular Install"; command = "$pm install"; cwd = $angularDir; reason = "Install Angular dependencies."; expected = "Dependencies installed."; required = $false }
    )

    Invoke-Flow -FlowLabel "DEV-QUICK" -Steps $steps

    # Phase 2: Start servers
    Start-FastApiServer
    Start-AngularDevServer

    Write-Host ""
    Write-Log -Level "SUCCESS" -StepLabel "DEV-QUICK" -Message "✅ Dev stack is running!"
    Write-Host ""
    Write-Host "  PostgreSQL:  localhost:5432" -ForegroundColor Green
    Write-Host "  Adminer:     http://localhost:8080" -ForegroundColor Green
    Write-Host "  FastAPI:     http://localhost:8000" -ForegroundColor Green
    Write-Host "  Swagger:     http://localhost:8000/docs" -ForegroundColor Green
    Write-Host "  Angular:     http://localhost:4200" -ForegroundColor Green
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════
# PROD — Container Builds
# ═══════════════════════════════════════════════════════════

function Invoke-ProdBuildAll {
    Write-Log -Level "STEP" -StepLabel "PROD-BUILD" -Message "Building all production container images..."

    $prodCompose = Join-Path $script:RepoRoot "docker-compose.prod.yml"
    if (-not (Test-Path $prodCompose)) {
        Write-Log -Level "ERROR" -StepLabel "PROD-BUILD" -Message "docker-compose.prod.yml not found. Create it first (see docs/spec_v3.0_devops_script.md)."
        return
    }

    Invoke-Flow -FlowLabel "PROD-BUILD-ALL" -Steps @(
        @{ name = "Build ALL images"; command = "docker compose -f docker-compose.prod.yml build"; cwd = $script:RepoRoot; reason = "Build all production container images."; expected = "All images built successfully."; required = $true }
    )
}

function Invoke-ProdBuildComponent {
    param([string]$Service, [string]$Label)

    $prodCompose = Join-Path $script:RepoRoot "docker-compose.prod.yml"
    if (-not (Test-Path $prodCompose)) {
        Write-Log -Level "ERROR" -StepLabel "PROD-BUILD" -Message "docker-compose.prod.yml not found."
        return
    }

    Invoke-Flow -FlowLabel "PROD-BUILD-$($Label.ToUpper())" -Steps @(
        @{ name = "Build $Label"; command = "docker compose -f docker-compose.prod.yml build $Service"; cwd = $script:RepoRoot; reason = "Build $Label production image."; expected = "Image built."; required = $true }
    )
}

# ═══════════════════════════════════════════════════════════
# PROD — Local Docker Deployment
# ═══════════════════════════════════════════════════════════

function Invoke-ProdLocalUp {
    $prodCompose = Join-Path $script:RepoRoot "docker-compose.prod.yml"
    if (-not (Test-Path $prodCompose)) {
        Write-Log -Level "ERROR" -StepLabel "PROD-LOCAL" -Message "docker-compose.prod.yml not found."
        return
    }

    Invoke-Flow -FlowLabel "PROD-LOCAL-UP" -Steps @(
        @{ name = "Start prod containers"; command = "docker compose -f docker-compose.prod.yml up -d"; cwd = $script:RepoRoot; reason = "Start all production containers locally."; expected = "All containers running."; required = $true }
    )
}

function Invoke-ProdLocalDown {
    $prodCompose = Join-Path $script:RepoRoot "docker-compose.prod.yml"
    if (-not (Test-Path $prodCompose)) {
        Write-Log -Level "ERROR" -StepLabel "PROD-LOCAL" -Message "docker-compose.prod.yml not found."
        return
    }

    Invoke-Flow -FlowLabel "PROD-LOCAL-DOWN" -Steps @(
        @{ name = "Stop prod containers"; command = "docker compose -f docker-compose.prod.yml down"; cwd = $script:RepoRoot; reason = "Stop all production containers."; expected = "Containers stopped."; required = $true }
    )
}

function Invoke-ProdLocalStatus {
    Write-Host ""
    Write-Host "═══ Production Containers (Local) ═══" -ForegroundColor Cyan
    try {
        $status = docker compose -f docker-compose.prod.yml ps 2>&1
        $status | ForEach-Object { Write-Host "  $_" }
    } catch {
        Write-Host "  docker-compose.prod.yml not found or Docker unavailable." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Recent logs:" -ForegroundColor DarkGray
    try {
        docker compose -f docker-compose.prod.yml logs --tail=20 2>&1 | ForEach-Object { Write-Host "    $_" }
    } catch { }
    Write-Host ""
}

function Invoke-ProdLocalReset {
    $prodCompose = Join-Path $script:RepoRoot "docker-compose.prod.yml"
    if (-not (Test-Path $prodCompose)) {
        Write-Log -Level "ERROR" -StepLabel "PROD-RESET" -Message "docker-compose.prod.yml not found."
        return
    }

    Invoke-Flow -FlowLabel "PROD-LOCAL-RESET" -Steps @(
        @{ name = "Stop containers"; command = "docker compose -f docker-compose.prod.yml down -v"; cwd = $script:RepoRoot; reason = "Stop containers and remove volumes."; expected = "Containers and volumes removed."; required = $true },
        @{ name = "Rebuild images"; command = "docker compose -f docker-compose.prod.yml build --no-cache"; cwd = $script:RepoRoot; reason = "Rebuild all images from scratch."; expected = "Images rebuilt."; required = $true },
        @{ name = "Start containers"; command = "docker compose -f docker-compose.prod.yml up -d"; cwd = $script:RepoRoot; reason = "Start fresh containers."; expected = "Containers running."; required = $true }
    )
}

# ═══════════════════════════════════════════════════════════
# PROD — Remote Docker Deployment
# ═══════════════════════════════════════════════════════════

function Get-RemoteConfig {
    if (Test-Path $script:RemoteConfigPath) {
        try {
            return Get-Content -Raw -Path $script:RemoteConfigPath | ConvertFrom-Json
        } catch {
            Write-Log -Level "WARN" -StepLabel "REMOTE" -Message "Failed to read remote.json, will prompt for config."
        }
    }
    return $null
}

function Save-RemoteConfig {
    param($Config)
    $Config | ConvertTo-Json -Depth 5 | Set-Content -Path $script:RemoteConfigPath -Encoding UTF8
    Write-Log -Level "SUCCESS" -StepLabel "REMOTE" -Message "✅ Remote config saved to $script:RemoteConfigPath"
}

function Invoke-RemoteSetup {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Remote Host Setup — Ubuntu 24 Docker Server" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    $existing = Get-RemoteConfig
    $defaultHost = if ($existing) { $existing.host } else { "" }
    $defaultUser = if ($existing) { $existing.user } else { "deploy" }
    $defaultPort = if ($existing) { $existing.port } else { 22 }
    $defaultPath = if ($existing) { $existing.deployPath } else { "/opt/openmath" }
    $defaultKey  = if ($existing) { $existing.sshKeyPath } else { "~/.ssh/id_ed25519" }

    $remoteHost = Read-Host "Remote host [$defaultHost]"
    if ([string]::IsNullOrWhiteSpace($remoteHost)) { $remoteHost = $defaultHost }
    if ([string]::IsNullOrWhiteSpace($remoteHost)) { Write-Host "Host is required." -ForegroundColor Red; return }

    $remoteUser = Read-Host "SSH user [$defaultUser]"
    if ([string]::IsNullOrWhiteSpace($remoteUser)) { $remoteUser = $defaultUser }

    $remotePort = Read-Host "SSH port [$defaultPort]"
    if ([string]::IsNullOrWhiteSpace($remotePort)) { $remotePort = $defaultPort }

    $remotePath = Read-Host "Deploy path [$defaultPath]"
    if ([string]::IsNullOrWhiteSpace($remotePath)) { $remotePath = $defaultPath }

    $remoteKey = Read-Host "SSH key path [$defaultKey]"
    if ([string]::IsNullOrWhiteSpace($remoteKey)) { $remoteKey = $defaultKey }

    $config = [pscustomobject]@{
        host = $remoteHost
        user = $remoteUser
        port = [int]$remotePort
        deployPath = $remotePath
        sshKeyPath = $remoteKey
    }

    Save-RemoteConfig -Config $config

    # Test connectivity
    Write-Log -Level "STEP" -StepLabel "REMOTE-SETUP" -Message "Testing SSH connectivity..."

    $sshTarget = "$($config.user)@$($config.host)"
    $sshArgs = "-p $($config.port) -i `"$($config.sshKeyPath)`" -o StrictHostKeyChecking=no -o ConnectTimeout=10"

    Invoke-Flow -FlowLabel "REMOTE-SETUP" -Steps @(
        @{ name = "Test SSH"; command = "ssh $sshArgs $sshTarget `"echo ok`""; cwd = $script:RepoRoot; reason = "Verify SSH connectivity."; expected = "ok"; required = $true },
        @{ name = "Check Docker"; command = "ssh $sshArgs $sshTarget `"docker --version`""; cwd = $script:RepoRoot; reason = "Verify Docker on remote."; expected = "Docker version output."; required = $true },
        @{ name = "Check Compose"; command = "ssh $sshArgs $sshTarget `"docker compose version`""; cwd = $script:RepoRoot; reason = "Verify Docker Compose on remote."; expected = "Compose version output."; required = $true },
        @{ name = "Create deploy dir"; command = "ssh $sshArgs $sshTarget `"mkdir -p $($config.deployPath)`""; cwd = $script:RepoRoot; reason = "Create deployment directory."; expected = "Directory created or exists."; required = $true },
        @{ name = "Transfer compose file"; command = "scp -P $($config.port) -i `"$($config.sshKeyPath)`" docker-compose.prod.yml $sshTarget`:$($config.deployPath)/"; cwd = $script:RepoRoot; reason = "Upload production compose file."; expected = "File transferred."; required = $true }
    )
}

function Get-SshCommand {
    $config = Get-RemoteConfig
    if (-not $config) {
        throw "Remote host not configured. Run Setup remote host first."
    }
    $sshTarget = "$($config.user)@$($config.host)"
    $sshArgs = "-p $($config.port) -i `"$($config.sshKeyPath)`" -o StrictHostKeyChecking=no"
    return @{ target = $sshTarget; args = $sshArgs; config = $config }
}

function Invoke-RemotePush {
    $ssh = Get-SshCommand

    Write-Log -Level "STEP" -StepLabel "REMOTE-PUSH" -Message "Pushing container images to remote..."

    Invoke-Flow -FlowLabel "REMOTE-PUSH" -Steps @(
        @{ name = "Save images"; command = "docker save openmath-api openmath-angular openmath-db -o openmath-images.tar"; cwd = $script:RepoRoot; reason = "Export container images to tar."; expected = "openmath-images.tar created."; required = $true },
        @{ name = "Transfer images"; command = "scp -P $($ssh.config.port) -i `"$($ssh.config.sshKeyPath)`" openmath-images.tar $($ssh.target):$($ssh.config.deployPath)/"; cwd = $script:RepoRoot; reason = "Upload images to remote server."; expected = "File transferred."; required = $true },
        @{ name = "Load images on remote"; command = "ssh $($ssh.args) $($ssh.target) `"docker load -i $($ssh.config.deployPath)/openmath-images.tar`""; cwd = $script:RepoRoot; reason = "Import container images on remote."; expected = "Images loaded."; required = $true }
    )
}

function Invoke-RemoteUp {
    $ssh = Get-SshCommand

    Invoke-Flow -FlowLabel "REMOTE-UP" -Steps @(
        @{ name = "Start remote containers"; command = "cmd.exe /d /c `"ssh $($ssh.args) $($ssh.target) `"cd $($ssh.config.deployPath) && docker compose -f docker-compose.prod.yml up -d`"`""; cwd = $script:RepoRoot; reason = "Start production stack on remote."; expected = "Containers running."; required = $true }
    )
}

function Invoke-RemoteDown {
    $ssh = Get-SshCommand

    Invoke-Flow -FlowLabel "REMOTE-DOWN" -Steps @(
        @{ name = "Stop remote containers"; command = "cmd.exe /d /c `"ssh $($ssh.args) $($ssh.target) `"cd $($ssh.config.deployPath) && docker compose -f docker-compose.prod.yml down`"`""; cwd = $script:RepoRoot; reason = "Stop production stack on remote."; expected = "Containers stopped."; required = $true }
    )
}

function Invoke-RemoteStatus {
    $ssh = Get-SshCommand

    Write-Host ""
    Write-Host "═══ Production Containers (Remote: $($ssh.config.host)) ═══" -ForegroundColor Cyan
    try {
        $output = & cmd.exe /d /c "ssh $($ssh.args) $($ssh.target) ""cd $($ssh.config.deployPath) && docker compose -f docker-compose.prod.yml ps""" 2>&1
        $output | ForEach-Object { Write-Host "  $_" }
    } catch {
        Write-Host "  Failed to connect to remote host." -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  Recent logs:" -ForegroundColor DarkGray
    try {
        $logs = & cmd.exe /d /c "ssh $($ssh.args) $($ssh.target) ""cd $($ssh.config.deployPath) && docker compose -f docker-compose.prod.yml logs --tail=20""" 2>&1
        $logs | ForEach-Object { Write-Host "    $_" }
    } catch { }
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════
# Menu System
# ═══════════════════════════════════════════════════════════

function Show-MainMenu {
    while ($true) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "  OpenMath DevOps Console (dev.ps1)" -ForegroundColor Cyan
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [D] DEV  — Windows 11 — Docker + uvicorn + ng serve / Vite" -ForegroundColor Green
        Write-Host "  [P] PROD — Docker containers — local or remote deployment" -ForegroundColor Magenta
        Write-Host "  [H] Check Requirements (verify all prerequisites)" -ForegroundColor Yellow
        Write-Host "  [L] Open latest log"
        Write-Host "  [0] Exit"
        Write-Host ""

        $choice = Read-Host "Choose"
        switch ($choice.ToUpperInvariant()) {
            "D" { Show-DevMenu }
            "P" { Show-ProdMenu }
            "H" { Invoke-CheckRequirements }
            "L" { Open-LatestLog }
            "0" { return }
            default { Write-Host "Invalid choice. Press D, P, H, L, or 0." -ForegroundColor Yellow }
        }
    }
}

function Show-DevMenu {
    while ($true) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host "  DEV — Windows 11 — Docker + uvicorn + ng serve / Vite" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Current Dev Stack: Postgres + Python FastAPI + Angular/PrimeNG" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  [Q] Quick Start Dev Stack (Postgres + FastAPI + Angular)" -ForegroundColor Green
        Write-Host ""
        Write-Host "  ─── Database 1 (Docker / PostgreSQL) ───" -ForegroundColor Cyan
        Write-Host "  [D1] Init (verify Docker, create .env)"
        Write-Host "  [D2] Build (docker compose build)"
        Write-Host "  [D3] Start (docker compose up -d)"
        Write-Host "  [D4] Apply Migrations"
        Write-Host "  [D5] Stop (docker compose down)"
        Write-Host "  [D6] Status + Logs"
        Write-Host ""
        Write-Host "  ─── Backend 1 (Python FastAPI) ───" -ForegroundColor Cyan
        Write-Host "  [B1] Init (create venv, install deps)"
        Write-Host "  [B2] Start (uvicorn --reload)"
        Write-Host "  [B3] Stop"
        Write-Host "  [B4] Status + Logs"
        Write-Host ""
        Write-Host "  ─── Frontend 1 (React JS) ───" -ForegroundColor DarkGray
        Write-Host "  [F1] Not yet implemented" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  ─── Frontend 2 (Vue.js / Nuxt 4) ───" -ForegroundColor Cyan
        Write-Host "  [N1] Init (pnpm install, approve builds, nuxt prepare)"
        Write-Host "  [N2] Start (Vite dev server)"
        Write-Host "  [N3] Stop"
        Write-Host "  [N4] Validate (typecheck)"
        Write-Host "  [N5] Build"
        Write-Host "  [N6] Status + Logs"
        Write-Host ""
        Write-Host "  ─── Frontend 3 (Angular + PrimeNG) ───" -ForegroundColor Cyan
        Write-Host "  [A1] Init (pnpm install)"
        Write-Host "  [A2] Start (ng serve)"
        Write-Host "  [A3] Stop"
        Write-Host "  [A4] Build"
        Write-Host "  [A5] Status + Logs"
        Write-Host ""
        Write-Host "  ─── Frontend 4 (Svelte) ───" -ForegroundColor DarkGray
        Write-Host "  [V1] Not yet implemented" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  [0] Back to main menu"
        Write-Host ""

        $choice = Read-Host "Choose"
        switch ($choice.ToUpperInvariant()) {
            # Quick Start
            "Q"  { Invoke-DevQuickStart }

            # Database
            "D1" { Invoke-DbInit }
            "D2" { Invoke-DbBuild }
            "D3" { Invoke-DbStart }
            "D4" { Invoke-DbMigrations }
            "D5" { Invoke-DbStop }
            "D6" { Invoke-DbStatus }

            # Backend
            "B1" { Invoke-FastApiInit }
            "B2" { Start-FastApiServer }
            "B3" { Stop-FastApiServer }
            "B4" { Invoke-FastApiStatus }

            # Frontend 1 — React (placeholder)
            "F1" { Show-NotImplemented -Name "React JS frontend" -SpecRef "docs/spec_react_fastapi.md" }

            # Frontend 2 — Nuxt
            "N1" { Invoke-NuxtInit }
            "N2" { Start-NuxtDevServer }
            "N3" { Stop-NuxtDevServer }
            "N4" { Invoke-NuxtValidate }
            "N5" { Invoke-NuxtBuild }
            "N6" { Invoke-NuxtStatus }

            # Frontend 3 — Angular
            "A1" { Invoke-AngularInit }
            "A2" { Start-AngularDevServer }
            "A3" { Stop-AngularDevServer }
            "A4" { Invoke-AngularBuild }
            "A5" { Invoke-AngularStatus }

            # Frontend 4 — Svelte (placeholder)
            "V1" { Show-NotImplemented -Name "Svelte frontend" -SpecRef "docs/spec_svelte_fastapi.md" }

            # Back
            "0"  { return }
            default { Write-Host "Invalid choice." -ForegroundColor Yellow }
        }
    }
}

function Show-ProdMenu {
    while ($true) {
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
        Write-Host "  PROD — Docker Container Deployment" -ForegroundColor Magenta
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "  Current Prod Stack: Postgres + Python FastAPI + Angular/PrimeNG" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  ─── Build Container Images ───" -ForegroundColor Cyan
        Write-Host "  [B1] Build ALL images (database + backend + frontend)"
        Write-Host "  [B2] Build Database image"
        Write-Host "  [B3] Build Backend image (python-api)"
        Write-Host "  [B4] Build Frontend 1 (React)       — not yet implemented" -ForegroundColor DarkGray
        Write-Host "  [B5] Build Frontend 2 (Nuxt)"
        Write-Host "  [B6] Build Frontend 3 (Angular)"
        Write-Host "  [B7] Build Frontend 4 (Svelte)      — not yet implemented" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  ─── Deploy to Local Docker (Docker Desktop) ───" -ForegroundColor Cyan
        Write-Host "  [L1] Start all containers"
        Write-Host "  [L2] Stop all containers"
        Write-Host "  [L3] Status + Logs"
        Write-Host "  [L4] Reset (stop + remove volumes + rebuild)"
        Write-Host ""
        Write-Host "  ─── Deploy to Remote Docker (Ubuntu 24 Server) ───" -ForegroundColor Cyan
        Write-Host "  [R1] Setup remote host (SSH key, Docker install check)"
        Write-Host "  [R2] Push images to remote"
        Write-Host "  [R3] Start all containers on remote"
        Write-Host "  [R4] Stop all containers on remote"
        Write-Host "  [R5] Status + Logs (remote)"
        Write-Host ""
        Write-Host "  [0] Back to main menu"
        Write-Host ""

        $choice = Read-Host "Choose"
        switch ($choice.ToUpperInvariant()) {
            # Build
            "B1" { Invoke-ProdBuildAll }
            "B2" { Invoke-ProdBuildComponent -Service "postgres" -Label "Database" }
            "B3" { Invoke-ProdBuildComponent -Service "python-api" -Label "Backend" }
            "B4" { Show-NotImplemented -Name "React frontend build" -SpecRef "docs/spec_react_fastapi.md" }
            "B5" { Invoke-ProdBuildComponent -Service "nuxt-app" -Label "Nuxt" }
            "B6" { Invoke-ProdBuildComponent -Service "angular-app" -Label "Angular" }
            "B7" { Show-NotImplemented -Name "Svelte frontend build" -SpecRef "docs/spec_svelte_fastapi.md" }

            # Local deploy
            "L1" { Invoke-ProdLocalUp }
            "L2" { Invoke-ProdLocalDown }
            "L3" { Invoke-ProdLocalStatus }
            "L4" { Invoke-ProdLocalReset }

            # Remote deploy
            "R1" { Invoke-RemoteSetup }
            "R2" { Invoke-RemotePush }
            "R3" { Invoke-RemoteUp }
            "R4" { Invoke-RemoteDown }
            "R5" { Invoke-RemoteStatus }

            # Back
            "0"  { return }
            default { Write-Host "Invalid choice." -ForegroundColor Yellow }
        }
    }
}

# ═══════════════════════════════════════════════════════════
# Entry Point — Mode Router
# ═══════════════════════════════════════════════════════════

try {
    Write-Log -Level "STEP" -StepLabel "BOOT" -Message "Run started in mode: $Mode"

    switch ($Mode.ToLowerInvariant()) {
        # Menu
        "menu"              { Show-MainMenu }

        # DEV shortcuts
        "dev-quick"         { Invoke-DevQuickStart }
        "db-init"           { Invoke-DbInit }
        "db-build"          { Invoke-DbBuild }
        "db-start"          { Invoke-DbStart }
        "db-stop"           { Invoke-DbStop }
        "db-migrate"        { Invoke-DbMigrations }
        "db-status"         { Invoke-DbStatus }
        "fastapi-init"      { Invoke-FastApiInit }
        "fastapi-start"     { Start-FastApiServer }
        "fastapi-stop"      { Stop-FastApiServer }
        "fastapi-status"    { Invoke-FastApiStatus }
        "nuxt-init"         { Invoke-NuxtInit }
        "nuxt-start"        { Start-NuxtDevServer }
        "nuxt-stop"         { Stop-NuxtDevServer }
        "nuxt-validate"     { Invoke-NuxtValidate }
        "nuxt-build"        { Invoke-NuxtBuild }
        "nuxt-status"       { Invoke-NuxtStatus }
        "angular-init"      { Invoke-AngularInit }
        "angular-start"     { Start-AngularDevServer }
        "angular-stop"      { Stop-AngularDevServer }
        "angular-build"     { Invoke-AngularBuild }
        "angular-status"    { Invoke-AngularStatus }

        # PROD shortcuts
        "prod-build"        { Invoke-ProdBuildAll }
        "prod-local-up"     { Invoke-ProdLocalUp }
        "prod-local-down"   { Invoke-ProdLocalDown }
        "prod-local-status" { Invoke-ProdLocalStatus }
        "prod-local-reset"  { Invoke-ProdLocalReset }
        "prod-remote-setup" { Invoke-RemoteSetup }
        "prod-remote-push"  { Invoke-RemotePush }
        "prod-remote-up"    { Invoke-RemoteUp }
        "prod-remote-down"  { Invoke-RemoteDown }
        "prod-remote-status"{ Invoke-RemoteStatus }

        # Utility
        "check-reqs"        { Invoke-CheckRequirements }

        # Legacy aliases (backward compat)
        "doctor"            { Invoke-CheckRequirements }
        "migrate-db"        { Invoke-DbMigrations }
        "validate-nuxt"     { Invoke-NuxtValidate }
        "build-nuxt"        { Invoke-NuxtBuild }
        "start-nuxt"        { Start-NuxtDevServer }
        "stop-nuxt"         { Stop-NuxtDevServer }
        "up-nuxt"           { Invoke-NuxtInit; Start-NuxtDevServer }
        "install-fastapi"   { Invoke-FastApiInit }
        "start-fastapi"     { Start-FastApiServer }
        "stop-fastapi"      { Stop-FastApiServer }
        "install-angular"   { Invoke-AngularInit }
        "start-angular"     { Start-AngularDevServer }
        "stop-angular"      { Stop-AngularDevServer }
        "build-angular"     { Invoke-AngularBuild }
        "up-v2"             { Invoke-DevQuickStart }

        "help" {
            Write-Host ""
            Write-Host "Available modes:" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "  Menu:" -ForegroundColor Green
            Write-Host "    menu              Interactive menu (default)"
            Write-Host ""
            Write-Host "  DEV shortcuts:" -ForegroundColor Green
            Write-Host "    dev-quick         Quick start: DB + FastAPI + Angular"
            Write-Host "    db-init           Init database prerequisites"
            Write-Host "    db-build          Build database containers"
            Write-Host "    db-start          Start PostgreSQL + Adminer"
            Write-Host "    db-stop           Stop database containers"
            Write-Host "    db-migrate        Apply SQL migrations"
            Write-Host "    db-status         Show database status"
            Write-Host "    fastapi-init      Create venv + install deps"
            Write-Host "    fastapi-start     Start FastAPI dev server"
            Write-Host "    fastapi-stop      Stop FastAPI dev server"
            Write-Host "    fastapi-status    Show FastAPI status"
            Write-Host "    nuxt-init         Install Nuxt dependencies"
            Write-Host "    nuxt-start        Start Nuxt dev server"
            Write-Host "    nuxt-stop         Stop Nuxt dev server"
            Write-Host "    nuxt-validate     Typecheck Nuxt project"
            Write-Host "    nuxt-build        Build Nuxt for production"
            Write-Host "    nuxt-status       Show Nuxt status"
            Write-Host "    angular-init      Install Angular dependencies"
            Write-Host "    angular-start     Start Angular dev server"
            Write-Host "    angular-stop      Stop Angular dev server"
            Write-Host "    angular-build     Build Angular for production"
            Write-Host "    angular-status    Show Angular status"
            Write-Host ""
            Write-Host "  PROD shortcuts:" -ForegroundColor Magenta
            Write-Host "    prod-build        Build all production images"
            Write-Host "    prod-local-up     Start local prod containers"
            Write-Host "    prod-local-down   Stop local prod containers"
            Write-Host "    prod-local-status Show local prod status"
            Write-Host "    prod-local-reset  Reset local prod (rebuild)"
            Write-Host "    prod-remote-setup Configure remote host"
            Write-Host "    prod-remote-push  Push images to remote"
            Write-Host "    prod-remote-up    Start remote containers"
            Write-Host "    prod-remote-down  Stop remote containers"
            Write-Host "    prod-remote-status Show remote status"
            Write-Host ""
            Write-Host "  Utility:" -ForegroundColor Yellow
            Write-Host "    check-reqs        Verify all prerequisites"
            Write-Host "    help              Show this help"
            Write-Host ""
            Write-Host "  Flags:" -ForegroundColor DarkGray
            Write-Host "    -AutoApprove      Skip confirmation prompts"
            Write-Host ""
        }

        default {
            Write-Log -Level "ERROR" -StepLabel "BOOT" -Message "Unknown mode: $Mode"
            Write-Host ""
            Write-Host "Run '.\dev.ps1 help' for available modes." -ForegroundColor Yellow
            throw "Unknown mode: $Mode"
        }
    }
}
catch {
    Write-Log -Level "ERROR" -StepLabel "FATAL" -Message $_.Exception.Message
    Show-Tail -Lines 200
    exit 1
}
finally {
    Save-Summary
    $end = [datetime](Get-Date)
    $startAt = [datetime]$script:StartAt
    $duration = [math]::Round(($end - $startAt).TotalSeconds, 2)
    $passed = @($script:StepResults | Where-Object { $_.status -eq "passed" }).Count
    $failed = @($script:StepResults | Where-Object { $_.status -eq "failed" }).Count
    $skipped = @($script:StepResults | Where-Object { $_.status -eq "skipped" }).Count
    $planned = @($script:StepResults | Where-Object { $_.status -eq "planned" }).Count

    Write-Host ""
    Write-Host "=== Run Summary ===" -ForegroundColor Cyan
    Write-Host "Duration: ${duration}s"
    Write-Host "Passed: $passed  Failed: $failed  Skipped: $skipped  Planned: $planned"
    Write-Host "Logs: $script:RunLogDir"
    Write-Host "Summary JSON: $script:SummaryPath"
}
