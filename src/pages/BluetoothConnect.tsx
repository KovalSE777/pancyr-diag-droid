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
    <div className="min-h-screen bg-background relative overflow-hidden safe-top safe-bottom">
      {/* Lightweight Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{ backgroundImage: `url(${patternBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 to-background" />
      </div>
      
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 relative">
        <div className="container mx-auto px-3 py-3 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-foreground hover:text-primary -ml-2"
            size="sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Назад
          </Button>
          <h1 className="text-2xl font-black gradient-text">Подключение</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="relative container mx-auto px-3 py-4 max-w-xl pb-20">
        {/* Compact Connection Status */}
        <Card className="premium-card p-6 mb-4">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <img 
                src={bluetoothPremiumIcon} 
                alt="Bluetooth" 
                className={`relative w-full h-full object-contain ${
                  connectionStatus === 'connected' ? 'scale-110' : ''
                }`}
              />
            </div>
            
            <div className="space-y-2">
              {getStatusIcon()}
              <h2 className="text-xl font-bold text-foreground">{getStatusText()}</h2>
              <p className="text-xs text-muted-foreground">
                {connectionStatus === 'idle' && 'Подключитесь к БСКУ'}
                {connectionStatus === 'searching' && 'Поиск устройств...'}
                {connectionStatus === 'connecting' && 'Соединение...'}
                {connectionStatus === 'connected' && 'Готово!'}
                {connectionStatus === 'error' && 'Проверьте Bluetooth'}
              </p>
            </div>

            {!isConnected && !isConnecting && (
              <Button 
                onClick={handleConnect}
                className="w-full bg-primary hover:bg-primary/90 font-semibold text-sm py-5 rounded-lg transition-colors min-h-[48px]"
              >
                <Bluetooth className="mr-2 h-4 w-4" />
                Подключиться
              </Button>
            )}
          </div>
        </Card>

        {/* Compact Instructions */}
        <Card className="glass-card p-4 mb-3">
          <h3 className="text-sm font-bold mb-3 text-foreground">Инструкция</h3>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>БСКУ включен (12/24В)</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Bluetooth включен</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>Выберите "Pantsir" или "BSKU"</span>
            </li>
          </ol>
        </Card>

        {/* Compact Demo Mode */}
        <Card className="glass-card p-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Тест без устройства
            </p>
            <Button 
              variant="outline" 
              onClick={handleUseMockData}
              className="border-accent/50 text-accent hover:bg-accent/20 text-sm py-4 w-full"
            >
              Демо-данные
            </Button>
          </div>
        </Card>
      </main>

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
        <DialogContent className="glass-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black gradient-text">Выберите устройство</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              Для некоторых модулей Android запросит PIN — введите <span className="font-mono font-bold text-primary">{BT_DEFAULT_PIN}</span>
            </p>
            <div className="max-h-60 overflow-auto border-2 border-border/50 rounded-xl divide-y divide-border/30 glass-card">
              {devices.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {isScanning ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span>Сканирование устройств...</span>
                    </div>
                  ) : (
                    'Устройства не найдены'
                  )}
                </div>
              ) : (
                devices.map((d) => (
                  <div key={d.deviceId} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors">
                    <div>
                      <div className="font-semibold text-base text-foreground">{d.name || 'Неизвестное устройство'}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">{d.deviceId}</div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => connectToDevice(d.deviceId)} 
                      disabled={isConnecting}
                      className="min-w-[110px] shadow-lg"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          <span className="text-xs">Подключение...</span>
                        </>
                      ) : (
                        'Подключить'
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={startScan} disabled={isScanning} className="font-semibold">
                {isScanning ? 'Сканирование...' : 'Обновить список'}
              </Button>
              <Button variant="ghost" onClick={() => setDevicePickerOpen(false)} className="font-semibold">
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      
    </div>
  );
};

export default BluetoothConnect;
