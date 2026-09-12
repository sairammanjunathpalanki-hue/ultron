$env:JAVA_HOME = "C:\Users\venka\jdk-17"
$env:ANDROID_HOME = "C:\Users\venka\android-sdk"
$env:PATH = "C:\Users\venka\jdk-17\bin;C:\Users\venka\android-sdk\cmdline-tools\latest\bin;" + $env:PATH

$sdkManager = "C:\Users\venka\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat"

Write-Host "Accepting Android SDK licenses..."
@("y","y","y","y","y","y","y","y","y","y") | & $sdkManager --sdk_root="C:\Users\venka\android-sdk" --licenses

Write-Host "Installing platform-tools, platforms;android-34, build-tools;34.0.0..."
@("y","y","y","y","y","y","y","y","y","y") | & $sdkManager --sdk_root="C:\Users\venka\android-sdk" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

Write-Host "Android SDK Installation complete!"
