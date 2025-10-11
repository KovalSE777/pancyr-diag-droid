import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ba41ab0de47a46879e70cd17cee4dfd3',
  appName: 'pancyr-diag-droid',
  webDir: 'dist',
  bundledWebRuntime: false,
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
