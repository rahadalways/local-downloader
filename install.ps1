# Parameters
$AppName = "Local Downloader"
$ExeName = "LocalDownloader.exe"
$InstallDir = "$env:LocalAppData\Programs\LocalDownloader"
$ExePath = Join-Path $InstallDir $ExeName

# Ensure System.Windows.Forms is loaded
Add-Type -AssemblyName System.Windows.Forms

# Check if the source executable exists
$SourceExe = Join-Path $PSScriptRoot "dist\LocalDownloader.exe"
if (!(Test-Path $SourceExe)) {
    [System.Windows.Forms.MessageBox]::Show("Source executable (dist\LocalDownloader.exe) not found.`nPlease run build_app.py first to compile the app.", "Installation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    exit 1
}

try {
    # 1. Terminate any running processes to prevent file lock
    Stop-Process -Name "LocalDownloader" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "AntigravityDownloader" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    # 2. Create Installation Directory
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    # 3. Copy the compiled executable
    Copy-Item $SourceExe $ExePath -Force

    # 4. Create Desktop Shortcut
    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath "$AppName.lnk"))
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Supercharged Local Media Downloader"
    $Shortcut.IconLocation = "$ExePath,0"
    $Shortcut.Save()

    # 5. Create Start Menu Shortcut
    $StartMenuPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
    $StartMenuDir = Join-Path $StartMenuPath $AppName
    New-Item -ItemType Directory -Force -Path $StartMenuDir | Out-Null
    $MenuShortcut = $WshShell.CreateShortcut((Join-Path $StartMenuDir "$AppName.lnk"))
    $MenuShortcut.TargetPath = $ExePath
    $MenuShortcut.WorkingDirectory = $InstallDir
    $MenuShortcut.Description = "Supercharged Local Media Downloader"
    $MenuShortcut.IconLocation = "$ExePath,0"
    $MenuShortcut.Save()

    # 6. Add to Windows Add/Remove Programs (Registry) for clean uninstallation
    $RegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalDownloader"
    if (!(Test-Path $RegistryPath)) {
        New-Item -Path $RegistryPath -Force | Out-Null
    }
    New-ItemProperty -Path $RegistryPath -Name "DisplayName" -Value $AppName -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $RegistryPath -Name "UninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$InstallDir\uninstall.ps1`"" -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $RegistryPath -Name "DisplayIcon" -Value $ExePath -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $RegistryPath -Name "Publisher" -Value "Local Downloader Team" -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $RegistryPath -Name "DisplayVersion" -Value "1.0.0" -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $RegistryPath -Name "EstimatedSize" -Value 45000 -PropertyType DWord -Force | Out-Null

    # 7. Create Uninstall script
    $UninstallScriptPath = Join-Path $InstallDir "uninstall.ps1"
    $UninstallContent = @"
Stop-Process -Name "LocalDownloader" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Remove-Item -Recurse -Force "$InstallDir"
`$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
Remove-Item -Force (Join-Path `$DesktopPath "$AppName.lnk") -ErrorAction SilentlyContinue
`$StartMenuPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
Remove-Item -Recurse -Force (Join-Path `$StartMenuPath "$AppName") -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalDownloader" -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("$AppName was uninstalled successfully.", "Uninstall Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
"@
    Set-Content -Path $UninstallScriptPath -Value $UninstallContent

    [System.Windows.Forms.MessageBox]::Show("Installation completed successfully!`n`nShortcuts created on your Desktop and Start Menu.", "Installation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)

} catch {
    [System.Windows.Forms.MessageBox]::Show("An error occurred during installation:`n$($_.Exception.Message)", "Installation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    exit 1
}
