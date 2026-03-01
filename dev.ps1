param(
    [Parameter(Position = 0)]
    [string]$Mode = "menu",
    [switch]$AutoApprove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:RepoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$script:RunId = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$script:RunLogDir = Join-Path $script:RepoRoot ".dev-assistant\logs\$script:RunId"
$script:RunLogPath = Join-Path $script:RunLogDir "run.log"
$script:ErrorLogPath = Join-Path $script:RunLogDir "errors.log"
$script:SummaryPath = Join-Path $script:RunLogDir "summary.json"
$script:CompactLogMode = $false
$script:StepResults = New-Object System.Collections.Generic.List[object]
$script:DetectedSignatures = New-Object System.Collections.Generic.List[string]
$script:StartAt = Get-Date
$script:CurrentMode = $Mode
$script:ShellExe = if ($PSVersionTable.PSEdition -eq "Core") { "pwsh" } else { "powershell" }
$script:LastLogLines = New-Object System.Collections.Generic.List[string]
$script:AutoApproveEnabled = [bool]$AutoApprove

New-Item -ItemType Directory -Force -Path $script:RunLogDir | Out-Null
New-Item -ItemType File -Force -Path $script:RunLogPath | Out-Null
New-Item -ItemType File -Force -Path $script:ErrorLogPath | Out-Null

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

    Write-Log -Level "WARN" -StepLabel $StepLabel -Message "Hotkeys are disabled in stable mode to avoid terminal host crashes."

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
        Write-Log -Level "INFO" -StepLabel $stepLabel -Message "Next: run manually later with '.\\dev.ps1' menu item or 'pnpm approve-builds' in nuxt-app."

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

function Invoke-Doctor {
    Write-Log -Level "STEP" -StepLabel "DOCTOR" -Message "Starting doctor checks"

    $checks = @(
        @{ name = "node"; hint = "Install Node.js LTS" },
        @{ name = "pnpm"; hint = "Run: npm install -g pnpm" },
        @{ name = "docker"; hint = "Install Docker Desktop" },
        @{ name = "git"; hint = "Install Git" }
    )

    foreach ($check in $checks) {
        if (Test-CommandExists -Name $check.name) {
            $version = Get-CommandVersion -Executable $check.name
            Write-Log -Level "SUCCESS" -StepLabel "DOCTOR" -Message "✅ PASS $($check.name) found ($version)"
        }
        else {
            Write-Log -Level "ERROR" -StepLabel "DOCTOR" -Message "❌ FAIL $($check.name) missing. Hint: $($check.hint)"
        }
    }

    if (Test-CommandExists -Name "docker") {
        try {
            $composeVersion = docker compose version 2>&1
            Write-Log -Level "SUCCESS" -StepLabel "DOCTOR" -Message "✅ PASS docker compose available ($($composeVersion | Select-Object -First 1))"
        }
        catch {
            Write-Log -Level "ERROR" -StepLabel "DOCTOR" -Message "❌ FAIL docker compose unavailable. Ensure Docker Desktop Compose V2 is enabled."
        }
    }

    $paths = @(
        @{ path = "docker-compose.yml"; hint = "Create root docker-compose.yml" },
        @{ path = "nuxt-app\package.json"; hint = "Initialize Nuxt app in nuxt-app" },
        @{ path = "nuxt-app\nuxt.config.ts"; hint = "Add nuxt config" }
    )

    foreach ($item in $paths) {
        $fullPath = Join-Path $script:RepoRoot $item.path
        if (Test-Path $fullPath) {
            Write-Log -Level "SUCCESS" -StepLabel "DOCTOR" -Message "✅ PASS found $($item.path)"
        }
        else {
            Write-Log -Level "ERROR" -StepLabel "DOCTOR" -Message "❌ FAIL missing $($item.path). Hint: $($item.hint)"
        }
    }

    $rootEnv = Join-Path $script:RepoRoot ".env"
    if (Test-Path $rootEnv) {
        $envText = Get-Content -Raw -Path $rootEnv
        if ($envText -match "DATABASE_URL\s*=") {
            Write-Log -Level "SUCCESS" -StepLabel "DOCTOR" -Message "✅ PASS root .env has DATABASE_URL"
        }
        else {
            Write-Log -Level "WARN" -StepLabel "DOCTOR" -Message "⚠️ WARN root .env missing DATABASE_URL. Add DATABASE_URL=..."
        }
    }
    else {
        Write-Log -Level "WARN" -StepLabel "DOCTOR" -Message "⚠️ WARN root .env not found. Add .env or .env.example."
    }

    foreach ($port in @(5432, 3000, 4000)) {
        $isOpen = Test-PortOpen -Port $port
        $state = if ($isOpen) { "in use" } else { "free" }
        $level = if ($isOpen) { "WARN" } else { "INFO" }
        Write-Log -Level $level -StepLabel "DOCTOR" -Message "Port $port is $state"
    }

    if ($script:RepoRoot -match "OneDrive") {
        Write-Log -Level "WARN" -StepLabel "DOCTOR" -Message "⚠️ WARN Repo appears under OneDrive path. This may slow Node installs/builds."
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
        throw "pnpm not found and AutoApprove is enabled. Explicit fallback confirmation required by spec."
    }

    $choice = Read-Host "pnpm not found. Use npm for this run? [y/N]"
    if ($choice.ToLowerInvariant() -eq "y") {
        Write-Log -Level "WARN" -StepLabel "PM" -Message "User confirmed fallback to npm for this run."
        return "npm"
    }

    throw "pnpm missing and npm fallback not approved."
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

function Invoke-NuxtValidate {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    $steps = @(
        @{ name = "DB Start"; command = "docker compose up -d"; cwd = $script:RepoRoot; reason = "Ensure postgres is running for app checks."; expected = "Postgres container starts or is already running."; required = $true },
        @{ name = "Nuxt Install"; command = "$pm install"; cwd = $nuxtDir; reason = "Install dependencies before validate."; expected = "Dependencies installed with lockfile honored."; required = $false },
        @{ name = "Approve Builds"; command = "$pm approve-builds"; cwd = $nuxtDir; reason = "Approve blocked package build scripts on Windows."; expected = "Build scripts approved or no action needed."; required = $false; skipInAutoApprove = $true },
        @{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = $nuxtDir; reason = "Generate Nuxt types and internal artifacts."; expected = "Nuxt prepare completes without errors."; required = $true },
        @{ name = "Nuxt Validate"; command = "$pm nuxt typecheck"; cwd = $nuxtDir; reason = "Validate Nuxt project types."; expected = "Typecheck passes."; required = $true }
    )

    Invoke-Flow -FlowLabel "NUXT-VALIDATE" -Steps $steps
}

function Invoke-NuxtBuild {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    $steps = @(
        @{ name = "Nuxt Install"; command = "$pm install"; cwd = $nuxtDir; reason = "Ensure dependencies for build."; expected = "Dependencies installed."; required = $false },
        @{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = $nuxtDir; reason = "Generate artifacts before build."; expected = "Prepare passes."; required = $true },
        @{ name = "Nuxt Build"; command = "$pm build"; cwd = $nuxtDir; reason = "Build production assets."; expected = "Nuxt build completes."; required = $true }
    )

    Invoke-Flow -FlowLabel "NUXT-BUILD" -Steps $steps
}

function Invoke-NuxtUp {
    $pm = Get-PackageManager
    $nuxtDir = Join-Path $script:RepoRoot "nuxt-app"

    $steps = @(
        @{ name = "DB Start"; command = "docker compose up -d"; cwd = $script:RepoRoot; reason = "Start shared postgres."; expected = "Database is running."; required = $true },
        @{ name = "Nuxt Install"; command = "$pm install"; cwd = $nuxtDir; reason = "Install dependencies."; expected = "Dependencies installed."; required = $false },
        @{ name = "Approve Builds"; command = "$pm approve-builds"; cwd = $nuxtDir; reason = "Approve build scripts."; expected = "Approve-builds complete."; required = $false; skipInAutoApprove = $true },
        @{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = $nuxtDir; reason = "Prepare Nuxt for dev."; expected = "Prepare complete."; required = $true },
        @{ name = "Nuxt Dev"; command = "$pm dev"; cwd = $nuxtDir; reason = "Start local dev server."; expected = "Dev server running with hot reload."; required = $true }
    )

    Invoke-Flow -FlowLabel "NUXT-UP" -Steps $steps
}

function Invoke-ReactPlanned {
    param([string]$Message)
    Write-Log -Level "WARN" -StepLabel "REACT-PLAN" -Message "Planned - not implemented yet: $Message"
    $script:StepResults.Add([ordered]@{
        label = "REACT-PLAN"
        name = $Message
        command = $null
        cwd = $script:RepoRoot
        status = "planned"
        durationSeconds = 0
        exitCode = $null
    }) | Out-Null
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

function Show-Menu {
    while ($true) {
        Write-Host ""
        Write-Host "=== Win11 Dev Assistant (dev.ps1) ===" -ForegroundColor Cyan
        Write-Host "1. Doctor (All)"
        Write-Host "2. Docker/DB: Start Postgres"
        Write-Host "3. Docker/DB: Stop Postgres"
        Write-Host "4. Docker/DB: Status + Logs (tail)"
        Write-Host "5. Nuxt: Install deps"
        Write-Host "6. Nuxt: Approve builds"
        Write-Host "7. Nuxt: Prepare"
        Write-Host "8. Nuxt: Validate"
        Write-Host "9. Nuxt: Build"
        Write-Host "10. Nuxt: Dev"
        Write-Host "11. Nuxt: Full Dev Up"
        Write-Host "12. React/Laravel: Doctor (planned)"
        Write-Host "13. React frontend: Install/Validate/Build (planned)"
        Write-Host "14. Laravel backend: Install/Test/Serve (planned)"
        Write-Host "15. React/Laravel: Full Dev Up (planned)"
        Write-Host "16. Open latest log file"
        Write-Host "0. Exit"

        $choice = Read-Host "Choose"
        switch ($choice) {
            "1" { Invoke-Doctor }
            "2" {
                Invoke-Flow -FlowLabel "DB-UP" -Steps @(@{ name = "DB Start"; command = "docker compose up -d"; cwd = $script:RepoRoot; reason = "Start postgres."; expected = "Container running."; required = $true })
            }
            "3" {
                Invoke-Flow -FlowLabel "DB-DOWN" -Steps @(@{ name = "DB Stop"; command = "docker compose down"; cwd = $script:RepoRoot; reason = "Stop containers."; expected = "Containers stopped."; required = $true })
            }
            "4" {
                Invoke-Flow -FlowLabel "DB-STATUS" -Steps @(
                    @{ name = "DB Status"; command = "docker compose ps"; cwd = $script:RepoRoot; reason = "Show container status."; expected = "Compose status output."; required = $true },
                    @{ name = "DB Logs Tail"; command = "docker compose logs --tail=100 postgres"; cwd = $script:RepoRoot; reason = "Show recent postgres logs."; expected = "Recent postgres log lines."; required = $false }
                )
            }
            "5" {
                $pm = Get-PackageManager
                Invoke-Flow -FlowLabel "NUXT-INSTALL" -Steps @(@{ name = "Nuxt Install"; command = "$pm install"; cwd = (Join-Path $script:RepoRoot "nuxt-app"); reason = "Install deps."; expected = "Dependencies installed."; required = $true })
            }
            "6" {
                $pm = Get-PackageManager
                Invoke-Flow -FlowLabel "NUXT-APPROVE" -Steps @(@{ name = "Approve Builds"; command = "$pm approve-builds"; cwd = (Join-Path $script:RepoRoot "nuxt-app"); reason = "Approve blocked scripts."; expected = "Approval complete."; required = $false })
            }
            "7" {
                $pm = Get-PackageManager
                Invoke-Flow -FlowLabel "NUXT-PREPARE" -Steps @(@{ name = "Nuxt Prepare"; command = "$pm nuxt prepare"; cwd = (Join-Path $script:RepoRoot "nuxt-app"); reason = "Generate Nuxt artifacts."; expected = "Prepare complete."; required = $true })
            }
            "8" { Invoke-NuxtValidate }
            "9" { Invoke-NuxtBuild }
            "10" {
                $pm = Get-PackageManager
                Invoke-Flow -FlowLabel "NUXT-DEV" -Steps @(@{ name = "Nuxt Dev"; command = "$pm dev"; cwd = (Join-Path $script:RepoRoot "nuxt-app"); reason = "Start dev server."; expected = "Server runs."; required = $true })
            }
            "11" { Invoke-NuxtUp }
            "12" { Invoke-ReactPlanned -Message "React/Laravel Doctor" }
            "13" { Invoke-ReactPlanned -Message "React frontend Install/Validate/Build" }
            "14" { Invoke-ReactPlanned -Message "Laravel backend Install/Test/Serve" }
            "15" { Invoke-ReactPlanned -Message "React/Laravel Full Dev Up" }
            "16" { Open-LatestLog }
            "0" { break }
            default { Write-Host "Invalid choice" -ForegroundColor Yellow }
        }
    }
}

try {
    Write-Log -Level "STEP" -StepLabel "BOOT" -Message "Run started in mode: $Mode"

    switch ($Mode.ToLowerInvariant()) {
        "menu" { Show-Menu }
        "doctor" { Invoke-Doctor }
        "validate-nuxt" { Invoke-NuxtValidate }
        "build-nuxt" { Invoke-NuxtBuild }
        "up-nuxt" { Invoke-NuxtUp }
        "up-react" { Invoke-ReactPlanned -Message "React/Laravel Full Dev Up" }
        "doctor-react" { Invoke-ReactPlanned -Message "React/Laravel Doctor" }
        default {
            Write-Log -Level "ERROR" -StepLabel "BOOT" -Message "Unknown mode: $Mode"
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
