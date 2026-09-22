import 'dotenv/config';
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || 'com.madatours.app',
  appName: 'MadaTours',
  webDir: 'dist/web',
  server: { androidScheme: 'https' },
};
export default config;
