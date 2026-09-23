import { config as loadEnv } from 'dotenv';
loadEnv({ path: ['.env.local', '.env'], quiet: true });
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || 'com.madatours.app',
  appName: 'MadaTours',
  webDir: 'dist/web',
  server: { androidScheme: 'https' },
};
export default config;
