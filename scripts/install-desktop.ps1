$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$targetDirectory = [IO.Path]::GetFullPath((Join-Path $desktopDirectory 'aura - btech final year project'))
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$executableName = "Aura $version.exe"
$sourceExecutable = Join-Path $projectRoot "release\$executableName"
if (-not (Test-Path -LiteralPath $sourceExecutable)) { throw 'Build the portable application with npm run package first.' }
$sourceApp = Join-Path $projectRoot 'release\win-unpacked'
$targetApp = Join-Path $targetDirectory 'app'
if (-not (Test-Path -LiteralPath (Join-Path $sourceApp 'Aura.exe'))) { throw 'The Windows runtime folder is missing. Rebuild with npm run package.' }

if ($projectRoot -ne $targetDirectory) {
    if ((Test-Path -LiteralPath $targetDirectory) -and -not (Test-Path -LiteralPath (Join-Path $targetDirectory '.aura-project'))) {
        throw 'Desktop/Aura already exists and is not marked as this project. No files were overwritten.'
    }
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $targetDirectory '.aura-project') -Value 'Aura desktop project, created by the local build workflow.'
    & robocopy $projectRoot $targetDirectory /E /XJ /XD node_modules .git release dist test-results app /XF '*.log' /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -gt 7) { throw "Project copy failed with code $LASTEXITCODE" }
}
New-Item -ItemType Directory -Path $targetApp -Force | Out-Null
& robocopy $sourceApp $targetApp /E /XJ /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -gt 7) { throw "Application copy failed with code $LASTEXITCODE" }

$shortcutPath = Join-Path $desktopDirectory 'Aura.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $targetApp 'Aura.exe'
$shortcut.WorkingDirectory = $targetDirectory
$shortcut.IconLocation = (Join-Path $targetDirectory 'build\icon.ico') + ',0'
$shortcut.Description = 'Aura — your intent, in motion. Text, voice, and verified desktop assistance.'
$shortcut.Save()

$sourceFiles = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -Recurse -File
foreach ($sourceFile in $sourceFiles) {
    $relative = $sourceFile.FullName.Substring($projectRoot.Length).TrimStart('\')
    $copy = Join-Path $targetDirectory $relative
    if ((Get-FileHash -LiteralPath $sourceFile.FullName).Hash -ne (Get-FileHash -LiteralPath $copy).Hash) { throw "Copy verification failed: $relative" }
}
if ((Get-FileHash -LiteralPath (Join-Path $sourceApp 'Aura.exe')).Hash -ne (Get-FileHash -LiteralPath $shortcut.TargetPath).Hash) { throw 'Executable copy verification failed.' }
Write-Output "Complete source project: $targetDirectory"
Write-Output "Verified application: $($shortcut.TargetPath)"
Write-Output "Desktop shortcut: $shortcutPath"
exit 0
