import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ultron.commandcenter',
  appName: 'ULTRON',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  backgroundColor: '#030306',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    Camera: {
      permissionsType: 'prompt',
    },
  },
};

export default config;
