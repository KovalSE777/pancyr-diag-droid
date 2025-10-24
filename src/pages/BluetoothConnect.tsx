import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bluetooth, Loader2, CheckCircle2, AlertCircle, Wrench } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { capacitorBluetoothService } from "@/utils/capacitor-bluetooth";
import { useToast } from "@/hooks/use-toast";
import bluetoothPremiumIcon from "@/assets/bluetooth-premium-icon.png";
import patternBg from "@/assets/pattern-bg.jpg";
import { Capacitor } from "@capacitor/core";
import { BluetoothSerial } from '@/utils/native-bluetooth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logService } from "@/utils/log-service";
import { BT_TIMING, BT_DEFAULT_PIN } from "@/utils/bluetooth-constants";
import { SystemType } from "@/types/bluetooth";
const BluetoothConnect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'searching' | 'connecting' | 'connected' | 'error'>('idle');
  
  type DiscoveredDevice = { deviceId: string; name?: string; rssi?: number };
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false); // Флаг отмены подключения
  const scanInProgressRef = useRef(false); // Защита от повторных вызовов
  
  const systemType = searchParams.get('type') || 'ska';

  const handleConnect = async () => {
    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Native: show device picker (scan will be triggered by useEffect)
        setDevicePickerOpen(true);
        setConnectionStatus('idle');
        setIsConnecting(false);
        return;
      }

      // Web: use browser chooser dialog
      setIsConnecting(true);
      setConnectionStatus('searching');

      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API не поддерживается в этом браузере. Используйте Chrome на Android или установите мобильное приложение.');
      }

      // Web Bluetooth в браузерах не используется - только мобильное приложение
      toast({ 
        title: 'Недоступно', 
        description: 'Web Bluetooth не поддерживается. Используйте мобильное приложение.',
        variant: 'destructive'
      });
      throw new Error('Используйте мобильное приложение для Bluetooth подключения');
    } catch (error) {
      setConnectionStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Не удалось подключиться к БСКУ';
      logService.error('BT Connect', errorMsg);
      toast({
        title: 'Ошибка подключения',
        description: errorMsg,
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  // Native scan and connect flow
  const startScan = async () => {
    // Защита от повторных вызовов
    if (scanInProgressRef.current) {
      logService.warn('BT Scan', 'Scan already in progress, ignoring duplicate call');
      return;
    }
    
    try {
      scanInProgressRef.current = true;
      setIsScanning(true);
      setDevices([]);
      logService.info('BT Scan', 'Starting scan...');
      const result = await BluetoothSerial.scan();
      const discoveredDevices = result.devices || [];
      logService.info('BT Scan', `Found ${discoveredDevices.length} devices`);
      setDevices(discoveredDevices.map(d => ({
        deviceId: d.address,
        name: d.name,
        rssi: undefined
      })));
      setIsScanning(false);
    } catch (e) {
      logService.error('BT Scan', `Scan failed: ${e instanceof Error ? e.message : String(e)}`);
      setIsScanning(false);
      toast({ 
        title: 'Ошибка сканирования', 
        description: e instanceof Error ? e.message : 'Не удалось начать сканирование', 
        variant: 'destructive' 
      });
    } finally {
      scanInProgressRef.current = false;
    }
  };

  const stopScan = async () => {
    setIsScanning(false);
    scanInProgressRef.current = false;
  };

  // Автоматический запуск сканирования при открытии диалога
  useEffect(() => {
    if (devicePickerOpen && Capacitor.isNativePlatform()) {
      startScan();
    }
  }, [devicePickerOpen]);

  const connectToDevice = async (deviceId: string) => {
    try {
      await stopScan();
      setIsConnecting(true);
      setConnectionStatus('connecting');
      setCancelRequested(false); // Сброс флага отмены
      
      logService.info('BT Connect', `Connecting to device: ${deviceId}`);
      
      // Проверяем формат MAC-адреса
      if (!deviceId || !/^[0-9A-Fa-f:]{17}$/.test(deviceId)) {
        throw new Error(`Неверный формат MAC-адреса: "${deviceId}". Ожидается формат XX:XX:XX:XX:XX:XX`);
      }
      
      toast({ title: 'Подключение...', description: `MAC: ${deviceId}. Может появиться запрос PIN — введите ${BT_DEFAULT_PIN}` });

      const ok = await capacitorBluetoothService.connectToDeviceId(deviceId, systemType.toUpperCase() as SystemType);
      
      // Проверяем, не была ли запрошена отмена
      if (cancelRequested) {
        logService.warn('BT Connect', 'Connection cancelled by user');
        await capacitorBluetoothService.disconnect();
        setConnectionStatus('idle');
        return;
      }
      
      if (ok) {
        setConnectionStatus('connected');
        setIsConnected(true);
        setDevicePickerOpen(false);
        toast({ title: 'Подключено успешно', description: 'Связь с БСКУ установлена' });
        setTimeout(() => navigate(`/diagnostics?type=${systemType}`), BT_TIMING.REDIRECT_DELAY);
      } else {
        throw new Error('Не удалось подключиться к выбранному устройству');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Сбой подключения';
      logService.error('BT Connect', `Failed to connect to ${deviceId}: ${errorMsg}`);
      setConnectionStatus('error');
      toast({ 
        title: 'Ошибка подключения', 
        description: errorMsg, 
        variant: 'destructive' 
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUseMockData = () => {
    toast({
      title: "Режим демонстрации",
      description: "Используются тестовые данные",
    });
    navigate(`/diagnostics?type=${systemType}&mock=true`);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'searching':
      case 'connecting':
        return <Loader2 className="w-16 h-16 text-primary animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-16 h-16 text-success" />;
      case 'error':
        return <AlertCircle className="w-16 h-16 text-destructive" />;
      default:
        return <Bluetooth className="w-16 h-16 text-primary" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'searching':
        return 'Поиск устройства...';
      case 'connecting':
        return 'Подключение...';
      case 'connected':
        return 'Подключено!';
      case 'error':
        return 'Ошибка подключения';
      default:
        return 'Готово к подключению';
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{ backgroundImage: `url(${patternBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      </div>
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
      
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <h1 className="text-3xl font-black gradient-text">Подключение</h1>
          <Button
            variant="ghost"
            onClick={() => navigate('/ble-debug')}
            className="text-muted-foreground hover:text-primary"
            title="Расширенная отладка BLE"
          >
            <Wrench className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-12 max-w-2xl">
        {/* Connection Status Card */}
        <Card className="premium-card p-12 mb-8 animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              <img 
                src={bluetoothPremiumIcon} 
                alt="Bluetooth" 
                className={`relative w-full h-full object-contain transition-all duration-500 drop-shadow-2xl ${
                  connectionStatus === 'connected' ? 'scale-110' : ''
                }`}
              />
            </div>
            
            <div className="space-y-2">
              {getStatusIcon()}
              <h2 className="text-3xl font-bold text-foreground">{getStatusText()}</h2>
              <p className="text-muted-foreground">
                {connectionStatus === 'idle' && 'Нажмите кнопку для подключения к БСКУ'}
                {connectionStatus === 'searching' && 'Ищем доступные устройства...'}
                {connectionStatus === 'connecting' && 'Устанавливаем соединение...'}
                {connectionStatus === 'connected' && 'Переход к диагностике...'}
                {connectionStatus === 'error' && 'Проверьте Bluetooth на БСКУ и повторите попытку'}
              </p>
            </div>

            {!isConnected && !isConnecting && (
              <Button 
                onClick={handleConnect}
                className="w-full max-w-xs btn-glow-primary bg-primary hover:bg-primary-glow font-semibold text-lg py-7 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Bluetooth className="mr-2 h-5 w-5" />
                Подключиться к БСКУ
              </Button>
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="glass-card p-8 mb-6 animate-fade-in [animation-delay:200ms]">
          <h3 className="text-xl font-bold mb-6 text-foreground">Инструкция по подключению</h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Убедитесь, что БСКУ включен и на него подано питание 12/24В</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Включите Bluetooth на вашем устройстве</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>Нажмите кнопку "Подключиться к БСКУ"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                4
              </span>
              <span>В появившемся окне выберите устройство "Pantsir" или "BSKU"</span>
            </li>
          </ol>
        </Card>

        {/* Demo Mode */}
        <Card className="glass-card p-8 animate-fade-in [animation-delay:300ms]">
          <div className="flex flex-col items-center text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Для тестирования без реального устройства
            </p>
            <Button 
              variant="outline" 
              onClick={handleUseMockData}
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            >
              Использовать демо-данные
            </Button>
          </div>
        </Card>
      </main>

      {/* Device picker (Native) */}
      <Dialog open={devicePickerOpen} onOpenChange={(o) => { 
        setDevicePickerOpen(o); 
        if (!o) {
          stopScan();
          // Если закрывают диалог во время подключения, отменяем операцию
          if (isConnecting) {
            setCancelRequested(true);
            setIsConnecting(false);
            setConnectionStatus('idle');
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выберите устройство</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Для некоторых модулей Android запросит PIN — введите {BT_DEFAULT_PIN}.
            </p>
            <div className="max-h-60 overflow-auto border rounded-md divide-y">
              {devices.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {isScanning ? 'Сканирование...' : 'Устройства не найдены'}
                </div>
              ) : (
                devices.map((d) => (
                  <div key={d.deviceId} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{d.name || 'Неизвестное устройство'}</div>
                      <div className="text-xs text-muted-foreground font-mono">{d.deviceId}</div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => connectToDevice(d.deviceId)} 
                      disabled={isConnecting}
                      className="min-w-[90px]"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Подключение...
                        </>
                      ) : (
                        'Подключить'
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={startScan} disabled={isScanning}>Обновить</Button>
              <Button variant="ghost" onClick={() => setDevicePickerOpen(false)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      
    </div>
  );
};

export default BluetoothConnect;
