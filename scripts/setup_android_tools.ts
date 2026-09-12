import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const USER_HOME = process.env.USERPROFILE || 'C:\\Users\\venka';
const JDK_DIR = path.join(USER_HOME, 'jdk-17');
const ANDROID_SDK_DIR = path.join(USER_HOME, 'android-sdk');

async function downloadFile(url: string, destPath: string) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10 * 1024 * 1024) {
    console.log(`Using existing cached file: ${destPath} (${(fs.statSync(destPath).size / (1024 * 1024)).toFixed(1)} MB)`);
    return;
  }

  console.log(`Downloading ${url} -> ${destPath}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.statusText} (${res.status})`);
  
  const fileStream = fs.createWriteStream(destPath);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Could not get response stream reader');

  let downloaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
    downloaded += value.length;
    if (downloaded % (15 * 1024 * 1024) < value.length) {
      console.log(`Downloaded ${(downloaded / (1024 * 1024)).toFixed(1)} MB...`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', () => {
      fileStream.close(() => resolve());
    });
    fileStream.on('error', reject);
    fileStream.end();
  });

  console.log(`Download complete: ${(downloaded / (1024 * 1024)).toFixed(1)} MB`);
}

function unzip(zipPath: string, destDir: string) {
  console.log(`Unzipping ${zipPath} to ${destDir}...`);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  execSync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
    stdio: 'inherit',
  });
}

async function main() {
  console.log('=====================================================');
  console.log(' ULTRON ANDROID BUILD TOOLCHAIN SETUP');
  console.log('=====================================================');

  // 1. Setup OpenJDK 17
  const javaExe = path.join(JDK_DIR, 'bin', 'java.exe');
  if (!fs.existsSync(javaExe)) {
    console.log('\n[1/3] Setting up OpenJDK 17...');
    const jdkZip = path.join(USER_HOME, 'temurin-jdk-17.zip');
    const jdkUrl = 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.14_7.zip';
    await downloadFile(jdkUrl, jdkZip);
    
    const tempExtract = path.join(USER_HOME, 'jdk-temp');
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    unzip(jdkZip, tempExtract);
    
    // Locate inner folder
    const innerFolders = fs.readdirSync(tempExtract);
    if (!innerFolders || innerFolders.length === 0) {
      throw new Error(`Extraction failed: no files in ${tempExtract}`);
    }
    const jdkSubdir = path.join(tempExtract, innerFolders[0]);
    if (fs.existsSync(JDK_DIR)) fs.rmSync(JDK_DIR, { recursive: true, force: true });
    fs.renameSync(jdkSubdir, JDK_DIR);
    fs.rmSync(tempExtract, { recursive: true, force: true });
    console.log(`JDK 17 successfully installed at: ${JDK_DIR}`);
  } else {
    console.log(`[1/3] OpenJDK 17 already present at: ${JDK_DIR}`);
  }

  // Verify Java
  const javaVer = execSync(`"${javaExe}" -version 2>&1`).toString();
  console.log('Java verified:\n' + javaVer);

  // 2. Setup Android Command-Line Tools
  const cmdlineZip = path.join(USER_HOME, 'commandlinetools.zip');
  const cmdlineDir = path.join(ANDROID_SDK_DIR, 'cmdline-tools', 'latest');
  const sdkManagerExe = path.join(cmdlineDir, 'bin', 'sdkmanager.bat');

  if (!fs.existsSync(sdkManagerExe)) {
    console.log('\n[2/3] Setting up Android Command-Line Tools...');
    const cmdlineUrl = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
    await downloadFile(cmdlineUrl, cmdlineZip);
    
    const tempCmd = path.join(USER_HOME, 'cmdline-temp');
    if (fs.existsSync(tempCmd)) fs.rmSync(tempCmd, { recursive: true, force: true });
    unzip(cmdlineZip, tempCmd);

    fs.mkdirSync(path.dirname(cmdlineDir), { recursive: true });
    if (fs.existsSync(cmdlineDir)) fs.rmSync(cmdlineDir, { recursive: true, force: true });
    
    // In Google zip, it unzips to cmdline-tools
    const inner = fs.readdirSync(tempCmd);
    const cmdSub = path.join(tempCmd, inner[0]);
    fs.renameSync(cmdSub, cmdlineDir);
    fs.rmSync(tempCmd, { recursive: true, force: true });
    console.log(`Android SDK Command-Line Tools ready at: ${cmdlineDir}`);
  } else {
    console.log(`[2/3] Android Command-Line Tools already present at: ${cmdlineDir}`);
  }

  // 3. Install Android SDK Platforms and Build Tools
  console.log('\n[3/3] Installing Android Platform & Build Tools...');
  process.env.JAVA_HOME = JDK_DIR;
  process.env.ANDROID_HOME = ANDROID_SDK_DIR;
  process.env.PATH = `${path.join(JDK_DIR, 'bin')};${path.join(cmdlineDir, 'bin')};${process.env.PATH}`;

  // Accept licenses
  console.log('Accepting Android SDK licenses...');
  try {
    execSync(`powershell -Command "for ($i=0; $i -lt 15; $i++) { 'y' } | & '${sdkManagerExe}' --sdk_root='${ANDROID_SDK_DIR}' --licenses"`, {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (_) {}

  // Install build-tools and platform 34
  console.log('Installing platform-tools, platforms;android-34, and build-tools;34.0.0...');
  execSync(`powershell -Command "for ($i=0; $i -lt 15; $i++) { 'y' } | & '${sdkManagerExe}' --sdk_root='${ANDROID_SDK_DIR}' 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'"`, {
    stdio: 'inherit',
    env: process.env,
  });

  // Save local.properties in android/
  const localProps = path.resolve(process.cwd(), 'android', 'local.properties');
  const escapedSdk = ANDROID_SDK_DIR.replace(/\\/g, '\\\\');
  fs.writeFileSync(localProps, `sdk.dir=${escapedSdk}\n`, 'utf8');
  console.log(`Saved ${localProps}`);

  console.log('\n=====================================================');
  console.log(' ANDROID TOOLCHAIN SETUP COMPLETED SUCCESSFULLY');
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
