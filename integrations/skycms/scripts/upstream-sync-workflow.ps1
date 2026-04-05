[CmdletBinding()]
param(
    [ValidateSet('status', 'sync-upstream', 'prepare-sync-branch', 'merge-into-skycms', 'run-all')]
    [string]$Command = 'run-all',

    [string]$SourceRemote = 'upstream',
    [string]$SourceBranch = 'main',
    [string]$UpstreamUrl = 'https://github.com/microsoft/monaco-editor.git',
    [string]$MirrorBranch = 'vendor/monaco-editor',
    [string]$AutomationBranch = 'sync/vendor-monaco-editor',
    [string]$CustomBranch = 'skycms/main',
    [string]$ForkRemote = '',

    [switch]$Push,
    [switch]$Merge,

    [string]$LogRoot = '',
    [switch]$FlatLogFolder
)

$ErrorActionPreference = 'Stop'

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptPath '../../..'))
$nodeScript = Join-Path $scriptPath 'upstream-sync-workflow.mjs'

if (-not (Test-Path $nodeScript)) {
    throw "Node workflow script not found: $nodeScript"
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    throw 'Node.js is required but was not found on PATH.'
}

if ([string]::IsNullOrWhiteSpace($LogRoot)) {
    $LogRoot = Join-Path $scriptPath '../logs/upstream-sync'
}

$runStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$logDir = $LogRoot
if (-not $FlatLogFolder) {
    $logDir = Join-Path $LogRoot $runStamp
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$summaryPath = Join-Path $logDir 'run-summary.txt'
"Run started: $(Get-Date -Format o)" | Set-Content -Path $summaryPath
"Command: $Command" | Add-Content -Path $summaryPath
"Repository: $repoRoot" | Add-Content -Path $summaryPath

function Invoke-Phase {
    param(
        [Parameter(Mandatory = $true)][string]$PhaseName,
        [Parameter(Mandatory = $true)][string[]]$PhaseArgs
    )

    $logPath = Join-Path $logDir ("{0}.log" -f $PhaseName)
    "Phase: $PhaseName" | Add-Content -Path $summaryPath
    "Log: $logPath" | Add-Content -Path $summaryPath

    Push-Location $repoRoot
    try {
        $output = & node $nodeScript @PhaseArgs 2>&1
        $output | Tee-Object -FilePath $logPath

        if ($LASTEXITCODE -ne 0) {
            "Result: FAILED ($LASTEXITCODE)" | Add-Content -Path $summaryPath
            throw "Phase '$PhaseName' failed with exit code $LASTEXITCODE"
        }

        "Result: OK" | Add-Content -Path $summaryPath
    }
    finally {
        Pop-Location
    }
}

function Build-BaseArgs {
    $args = @(
        '--source-remote', $SourceRemote,
        '--source-branch', $SourceBranch,
        '--upstream-url', $UpstreamUrl,
        '--mirror-branch', $MirrorBranch,
        '--automation-branch', $AutomationBranch,
        '--custom-branch', $CustomBranch
    )

    if (-not [string]::IsNullOrWhiteSpace($ForkRemote)) {
        $args += @('--fork-remote', $ForkRemote)
    }

    if ($Push) {
        $args += '--push'
    }

    return ,$args
}

$baseArgs = Build-BaseArgs

switch ($Command) {
    'status' {
        Invoke-Phase -PhaseName 'status' -PhaseArgs (@('status') + $baseArgs)
    }
    'sync-upstream' {
        Invoke-Phase -PhaseName 'sync-upstream' -PhaseArgs (@('sync-upstream') + $baseArgs)
    }
    'prepare-sync-branch' {
        Invoke-Phase -PhaseName 'prepare-sync-branch' -PhaseArgs (@('prepare-sync-branch') + $baseArgs)
    }
    'merge-into-skycms' {
        Invoke-Phase -PhaseName 'merge-into-skycms' -PhaseArgs (@('merge-into-skycms') + $baseArgs)
    }
    'run-all' {
        Invoke-Phase -PhaseName 'sync-upstream' -PhaseArgs (@('sync-upstream') + $baseArgs)
        Invoke-Phase -PhaseName 'prepare-sync-branch' -PhaseArgs (@('prepare-sync-branch') + $baseArgs)

        if ($Merge) {
            Invoke-Phase -PhaseName 'merge-into-skycms' -PhaseArgs (@('merge-into-skycms') + $baseArgs)
        }
        else {
            'Phase: merge-into-skycms (skipped; pass -Merge to include)' | Add-Content -Path $summaryPath
        }
    }
}

"Run finished: $(Get-Date -Format o)" | Add-Content -Path $summaryPath
Write-Host "Audit logs written to: $logDir"