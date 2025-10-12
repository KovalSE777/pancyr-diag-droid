import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ba41ab0de47a46879e70cd17cee4dfd3',
  appName: 'Diagnostics Pantcir',
  webDir: 'dist',
  bundledWebRuntime: false,
  
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
  // ВАЖНО: Для production APK закомментируй server.url
  // Раскомментируй только для разработки с hot reload
  // server: {
  //   url: 'https://ba41ab0d-e47a-4687-9e70-cd17cee4dfd3.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Поиск устройств...',
        cancel: 'Отмена',
        availableDevices: 'Доступные устройства',
        noDeviceFound: 'Устройства не найдены'
      }
    }
  }
};

export default config;
