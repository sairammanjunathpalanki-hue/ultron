$env:JAVA_HOME = "C:\Users\venka\jdk-17"
$env:ANDROID_HOME = "C:\Users\venka\android-sdk"
$env:PATH = "C:\Users\venka\jdk-17\bin;C:\Users\venka\android-sdk\platform-tools;C:\Users\venka\android-sdk\cmdline-tools\latest\bin;" + $env:PATH

Write-Host "====================================================="
Write-Host " BUILDING ULTRON ANDROID APK (GRADLE ASSEMBLEDEBUG)"
Write-Host "====================================================="

Set-Location -Path "c:\Users\venka\OneDrive\Desktop\ultron\android"

cmd.exe /c "gradlew.bat assembleDebug --stacktrace"

if ($LASTEXITCODE -eq 0) {
    Write-Host "====================================================="
    Write-Host " GRADLE BUILD SUCCEEDED!"
    Write-Host "====================================================="
    
    $apkSource = "c:\Users\venka\OneDrive\Desktop\ultron\android\app\build\outputs\apk\debug\app-debug.apk"
    $apkTarget = "c:\Users\venka\OneDrive\Desktop\ultron\dist\ultron-debug.apk"
    
    if (Test-Path $apkSource) {
        if (-not (Test-Path "c:\Users\venka\OneDrive\Desktop\ultron\dist")) {
            New-Item -ItemType Directory -Path "c:\Users\venka\OneDrive\Desktop\ultron\dist" | Out-Null
        }
        Copy-Item -Path $apkSource -Destination $apkTarget -Force
        Write-Host "SUCCESS: Real Android APK generated and ready for phone installation:"
        Write-Host "Source: $apkSource"
        Write-Host "Deploy: $apkTarget"
        Get-Item $apkTarget | Select-Object Name, Length, LastWriteTime | Format-List
    }
} else {
    Write-Host "Gradle build exited with code: $LASTEXITCODE"
    exit $LASTEXITCODE
}
