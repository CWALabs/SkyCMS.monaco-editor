[CmdletBinding(SupportsShouldProcess = $true)]
param(
	[string]$OriginRemote = '',
	[string]$UpstreamRemote = 'upstream',
	[string]$UpstreamUrl = 'https://github.com/microsoft/monaco-editor.git',
	[string]$UpstreamBranch = 'main',
	[string]$VendorBranch = 'vendor/monaco-editor',
	[switch]$Push,
	[switch]$SkipCleanCheck
)

# Mirrors the upstream Monaco Editor branch into a non-default vendor branch used by SkyCMS.
#
# Branch roles:
# - vendor/monaco-editor: upstream-tracking mirror branch.
# - skycms/main: SkyCMS customization and deployment branch.
#
# Promotion into skycms/main is intentionally handled via pull request review.

$ErrorActionPreference = 'Stop'

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
	}

	Write-Host "Fetching $upstreamRef..." -ForegroundColor Yellow
	Invoke-Git -Args @('fetch', $UpstreamRemote, $UpstreamBranch)

	if (-not (Test-GitRef -RefName "refs/remotes/$upstreamRef")) {
		throw "Upstream ref '$upstreamRef' was not found after fetch."
	}

	Write-Host "Refreshing vendor branch $VendorBranch from $upstreamRef..." -ForegroundColor Yellow
	Invoke-Git -Args @('checkout', '-B', $VendorBranch, $upstreamRef) -MutatesRepository -Operation 'reset vendor branch to upstream'

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