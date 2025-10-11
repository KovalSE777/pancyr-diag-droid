import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bluetooth, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { bluetoothService } from "@/utils/bluetooth";
import { capacitorBluetoothService } from "@/utils/capacitor-bluetooth";
import { useToast } from "@/hooks/use-toast";
import bluetoothIcon from "@/assets/bluetooth-icon.png";
import { Capacitor } from "@capacitor/core";

const BluetoothConnect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'searching' | 'connecting' | 'connected' | 'error'>('idle');
  
  const systemType = searchParams.get('type') || 'ska';

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('searching');
    
    try {
      // Check if we're running on native platform (iOS/Android)
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        // Use Capacitor Bluetooth on native platforms
        toast({
          title: "Поиск устройства...",
          description: "Включите Bluetooth на БСКУ",
        });

        setConnectionStatus('connecting');
        
        const connected = await capacitorBluetoothService.connect(systemType.toUpperCase() as 'SKA' | 'SKE');
        
        if (connected) {
          setConnectionStatus('connected');
          setIsConnected(true);
          
          toast({
            title: "Подключено успешно",
            description: "Связь с БСКУ установлена",
          });

          setTimeout(() => {
            navigate(`/diagnostics?type=${systemType}`);
          }, 1500);
        } else {
          throw new Error('Не удалось подключиться к устройству');
        }
      } else {
        // Use Web Bluetooth API on web
        if (!navigator.bluetooth) {
          throw new Error('Web Bluetooth API не поддерживается в этом браузере. Используйте Chrome на Android или установите мобильное приложение.');
        }

        toast({
          title: "Поиск устройства...",
          description: "Включите Bluetooth на БСКУ",
        });

        setConnectionStatus('connecting');
        
        const connected = await bluetoothService.connect(systemType.toUpperCase() as 'SKA' | 'SKE');
        
        if (connected) {
          setConnectionStatus('connected');
          setIsConnected(true);
          
          toast({
            title: "Подключено успешно",
            description: "Связь с БСКУ установлена",
          });

          setTimeout(() => {
            navigate(`/diagnostics?type=${systemType}`);
          }, 1500);
        } else {
          throw new Error('Не удалось подключиться к устройству');
        }
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('Connection error:', error);
      
      toast({
        title: "Ошибка подключения",
        description: error instanceof Error ? error.message : 'Не удалось подключиться к БСКУ',
        variant: "destructive",
      });
      
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Подключение</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Connection Status Card */}
        <Card className="p-12 bg-card border-border mb-8 animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-48 h-48 flex items-center justify-center">
              <img 
                src={bluetoothIcon} 
                alt="Bluetooth" 
                className={`w-full h-full object-contain transition-all duration-500 ${
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
                className="w-full max-w-xs bg-primary hover:bg-primary-glow text-lg py-6"
              >
                <Bluetooth className="mr-2 h-5 w-5" />
                Подключиться к БСКУ
              </Button>
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 bg-card border-border mb-6 animate-fade-in [animation-delay:200ms]">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Инструкция по подключению</h3>
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
        <Card className="p-6 bg-muted border-border animate-fade-in [animation-delay:300ms]">
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
    </div>
  );
};

export default BluetoothConnect;
