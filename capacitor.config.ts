import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ba41ab0de47a46879e70cd17cee4dfd3',
  appName: 'Панцирь Диагностика',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0a0f1a',
  
  // Настройки иконки и splash screen
  android: {
    icon: {
      sources: ['public/app-icon.png']
    },
    splash: {
      backgroundColor: '#0a0f1a',
      image: 'public/splash.png',
      imageWidth: 1080,
      imageHeight: 1920
    }
  },
  
  ios: {
    icon: {
      sources: ['public/app-icon.png']
    },
    splash: {
      backgroundColor: '#0a0f1a',
      image: 'public/splash.png',
      imageWidth: 1080,
      imageHeight: 1920
    }
  },
  // Production: server.url закомментирован для standalone APK
  // Development: раскомментируйте для hot-reload с Lovable preview
  /*
  server: {
    url: 'https://ba41ab0d-e47a-4687-9e70-cd17cee4dfd3.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  */
};

export default config;
