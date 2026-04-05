[CmdletBinding(SupportsShouldProcess = $true)]
param(
	[string]$OriginRemote = '',
	[string]$UpstreamRemote = 'upstream',
	[string]$UpstreamUrl = 'https://github.com/microsoft/monaco-editor.git',
	[string]$UpstreamBranch = 'main',
	[string]$VendorBranch = 'vendor/monaco-editor',
	[switch]$ExcludeWorkflowFiles,
	[switch]$Push,
	[switch]$SkipCleanCheck
)

# Mirrors the upstream Monaco Editor branch into a non-default vendor branch used by SkyCMS.
#
# Branch roles:
# - vendor/monaco-editor: upstream-tracking branch with upstream workflow files removed.
# - skycms/main: SkyCMS customization and deployment branch.
#
# Promotion into skycms/main is intentionally handled via pull request review.

$ErrorActionPreference = 'Stop'
$isWhatIf = [bool]$WhatIfPreference

function Invoke-Git {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Args,
		[switch]$MutatesRepository,
		[string]$Operation = 'git command'
	)

	$commandText = "git $($Args -join ' ')"

	if ($MutatesRepository -and -not $PSCmdlet.ShouldProcess($Operation, $commandText)) {
		return
	}

	Write-Host "> $commandText" -ForegroundColor Cyan
	& git @Args
	if ($LASTEXITCODE -ne 0) {
		throw "Git command failed: $commandText"
	}
}

function Get-GitOutput {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Args
	)

	$output = & git @Args
	if ($LASTEXITCODE -ne 0) {
		throw "Git command failed: git $($Args -join ' ')"
	}

	return ($output | Out-String).Trim()
}

function Test-GitRemoteBranch {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RemoteName,
		[Parameter(Mandatory = $true)]
		[string]$BranchName
	)

	& git ls-remote --exit-code --heads $RemoteName $BranchName | Out-Null
	return $LASTEXITCODE -eq 0
}

function Test-GitRef {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RefName
	)

	& git show-ref --verify --quiet $RefName
	return $LASTEXITCODE -eq 0
}

function Test-GitRemote {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RemoteName
	)

	$remoteNames = Get-GitOutput -Args @('remote')
	return ($remoteNames -split "`r?`n" | Where-Object { $_ -eq $RemoteName }).Count -gt 0
}

function Resolve-OriginRemote {
	param(
		[string]$ConfiguredOriginRemote
	)

	if ($ConfiguredOriginRemote) {
		return $ConfiguredOriginRemote
	}

	foreach ($candidate in @('cwalabs-split', 'origin')) {
		if (Test-GitRemote -RemoteName $candidate) {
			return $candidate
		}
	}

	throw "Could not resolve a fork remote. Pass -OriginRemote explicitly."
}

function Remove-UpstreamWorkflowFiles {
	$workflowDirectory = Join-Path $repoRoot '.github/workflows'

	if (-not (Test-Path $workflowDirectory)) {
		return
	}

	Write-Host 'Removing upstream workflow files from the vendor branch...' -ForegroundColor Yellow
	Invoke-Git -Args @('rm', '-r', '--ignore-unmatch', '.github/workflows') -MutatesRepository -Operation 'remove upstream workflow files from vendor branch'

	if (-not (Test-Path (Join-Path $repoRoot '.github'))) {
		return
	}

	$remainingFiles = Get-ChildItem -Path (Join-Path $repoRoot '.github') -Recurse -File -ErrorAction SilentlyContinue
	if (-not $remainingFiles) {
		Invoke-Git -Args @('rm', '-r', '--ignore-unmatch', '.github') -MutatesRepository -Operation 'remove empty .github directory from vendor branch'
	}
}

function Commit-VendorBranchSanitization {
	$status = Get-GitOutput -Args @('status', '--porcelain')
	if (-not $status) {
		return
	}

	Write-Host 'Committing vendor branch sanitization changes...' -ForegroundColor Yellow
	Invoke-Git -Args @('commit', '-m', 'chore: remove upstream workflow files from vendor branch') -MutatesRepository -Operation 'commit vendor branch sanitization changes'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot

try {
	if (-not $SkipCleanCheck) {
		$status = Get-GitOutput -Args @('status', '--porcelain')
		if ($status) {
			throw 'Working tree is not clean. Commit/stash your changes before running this script.'
		}
	}

	$originRemote = Resolve-OriginRemote -ConfiguredOriginRemote $OriginRemote
	$currentBranch = Get-GitOutput -Args @('branch', '--show-current')
	$upstreamRef = "$UpstreamRemote/$UpstreamBranch"

	if (Test-GitRemote -RemoteName $UpstreamRemote) {
		Write-Host "Refreshing remote '$UpstreamRemote'..." -ForegroundColor Yellow
		Invoke-Git -Args @('remote', 'set-url', $UpstreamRemote, $UpstreamUrl) -MutatesRepository -Operation 'update upstream remote URL'
	}
	else {
		Write-Host "Adding remote '$UpstreamRemote'..." -ForegroundColor Yellow
		Invoke-Git -Args @('remote', 'add', $UpstreamRemote, $UpstreamUrl) -MutatesRepository -Operation 'configure upstream remote'

		if ($isWhatIf) {
			Write-Host 'WhatIf mode: stopping before fetch because the upstream remote was not actually created.' -ForegroundColor Yellow
			return
		}
	}

	Write-Host "Fetching $upstreamRef..." -ForegroundColor Yellow
	Invoke-Git -Args @('fetch', $UpstreamRemote, $UpstreamBranch)

	if (-not (Test-GitRef -RefName "refs/remotes/$upstreamRef")) {
		throw "Upstream ref '$upstreamRef' was not found after fetch."
	}

	Write-Host "Refreshing vendor branch $VendorBranch from $upstreamRef..." -ForegroundColor Yellow
	Invoke-Git -Args @('checkout', '-B', $VendorBranch, $upstreamRef) -MutatesRepository -Operation 'reset vendor branch to upstream'

	if ($ExcludeWorkflowFiles) {
		Remove-UpstreamWorkflowFiles
		Commit-VendorBranchSanitization
	}

	if ($Push) {
		Write-Host "Pushing mirrored vendor branch to $originRemote/$VendorBranch..." -ForegroundColor Yellow

		if (Test-GitRemoteBranch -RemoteName $originRemote -BranchName $VendorBranch) {
			Invoke-Git -Args @('push', '--force-with-lease', $originRemote, "HEAD:refs/heads/$VendorBranch") -MutatesRepository -Operation 'push mirrored vendor branch'
		}
		else {
			Invoke-Git -Args @('push', '--set-upstream', $originRemote, "HEAD:refs/heads/$VendorBranch") -MutatesRepository -Operation 'create mirrored vendor branch on fork remote'
		}
	}

	if ($currentBranch -and $currentBranch -ne $VendorBranch) {
		Write-Host "Restoring original branch $currentBranch..." -ForegroundColor Yellow
		Invoke-Git -Args @('checkout', $currentBranch) -MutatesRepository -Operation 'restore original branch'
	}

	Write-Host 'Vendor sync complete.' -ForegroundColor Green
}
finally {
	Pop-Location
}