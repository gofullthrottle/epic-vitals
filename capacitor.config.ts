import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.epicvitals.formcoach',
  appName: 'FormCoach',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
