const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- ULTRON ANDROID DIAGNOSTIC ---');

const apkPath = 'c:\\Users\\venka\\OneDrive\\Desktop\\ultron\\ULTRON.apk';
const sdkDir = 'C:\\Users\\venka\\android-sdk';
console.log('SDK Directory:', sdkDir);

const adbPath = path.join(sdkDir, 'platform-tools', 'adb.exe');
console.log('adb Path exists:', fs.existsSync(adbPath));

if (fs.existsSync(adbPath)) {
  try {
    const devices = execSync(`"${adbPath}" devices -l`, { encoding: 'utf8' });
    console.log('\n[ADB DEVICES]:\n' + devices);
  } catch (e) {
    console.error('Error running adb devices:', e.message);
  }
}

// Find aapt or aapt2 and apksigner
const buildToolsDir = path.join(sdkDir, 'build-tools');
if (fs.existsSync(buildToolsDir)) {
  const versions = fs.readdirSync(buildToolsDir);
  console.log('Build tools versions:', versions);
  for (const v of versions) {
    const aapt = path.join(buildToolsDir, v, 'aapt.exe');
    const apksigner = path.join(buildToolsDir, v, 'apksigner.bat');
    if (fs.existsSync(aapt)) {
      console.log(`Found aapt in ${v}:`, aapt);
      try {
        const out = execSync(`"${aapt}" dump badging c:\\Users\\venka\\OneDrive\\Desktop\\ultron\\ULTRON.apk`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        const lines = out.split('\n');
        console.log('\n[AAPT BADGING SUMMARY]:');
        lines.filter(l => l.startsWith('package:') || l.startsWith('sdkName:') || l.startsWith('targetSdkVersion:') || l.startsWith('uses-permission:') || l.startsWith('launchable-activity:')).forEach(l => console.log(l));
      } catch (e) {
        console.error('Error running aapt:', e.message);
      }
    }
    if (fs.existsSync(apksigner)) {
      console.log(`Found apksigner in ${v}:`, apksigner);
      try {
        const env = { ...process.env, JAVA_HOME: 'C:\\Users\\venka\\jdk-17', PATH: `C:\\Users\\venka\\jdk-17\\bin;${process.env.PATH}` };
        const verifyOut = execSync(`"${apksigner}" verify --verbose --min-sdk-version 21 "${apkPath}"`, { encoding: 'utf8', env });
        console.log('\n[APKSIGNER VERIFY (min-sdk 21)]:\n' + verifyOut);
      } catch (e) {
        console.error('Error running apksigner verify:', e.message, e.stdout);
      }
      break;
    }
  }
}

// List META-INF and assets
try {
  const aapt = path.join(buildToolsDir, '34.0.0', 'aapt.exe');
  const out = execSync(`"${aapt}" list c:\\Users\\venka\\OneDrive\\Desktop\\ultron\\ULTRON.apk`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const allEntries = out.split('\n').map(e => e.trim()).filter(Boolean);
  console.log('\nTotal entries in APK:', allEntries.length);
  const meta = allEntries.filter(e => e.startsWith('META-INF'));
  console.log('[META-INF ENTRIES]:', meta);
  const publicAssets = allEntries.filter(e => e.startsWith('assets/public'));
  console.log('[PUBLIC ASSETS COUNT]:', publicAssets.length);
  const indexHtml = allEntries.find(e => e.endsWith('index.html'));
  console.log('[INDEX.HTML]:', indexHtml);
} catch (e) {
  console.error('Error listing APK entries:', e.message);
}
