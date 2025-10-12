import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity, AlertTriangle, Zap, Thermometer, Gauge, Wind, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { bluetoothService } from "@/utils/bluetooth";
import { capacitorBluetoothService } from "@/utils/capacitor-bluetooth";
import { DiagnosticData } from "@/types/bluetooth";
import { FanIndicator } from "@/components/diagnostics/FanIndicator";
import { ComponentIndicator } from "@/components/diagnostics/ComponentIndicator";
import { FuseIndicator } from "@/components/diagnostics/FuseIndicator";
import { SoftStartSignals } from "@/components/diagnostics/SoftStartSignals";
import { TestModeControl } from "@/components/diagnostics/TestModeControl";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { DebugLogPanel } from "@/components/diagnostics/DebugLogPanel";

const Diagnostics = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const { toast } = useToast();
  
  const systemType = searchParams.get('type') || 'ska';
  const useMock = searchParams.get('mock') === 'true';

  const handleTestModeChange = async (enabled: boolean) => {
    const isNative = Capacitor.isNativePlatform();
    const service = isNative ? capacitorBluetoothService : bluetoothService;
    
    if (!service.isConnected() && !useMock) {
      toast({
        title: "Нет подключения",
        description: "Подключитесь к устройству для управления",
        variant: "destructive"
      });
      return;
    }

    try {
      if (!useMock) {
        await service.setTestMode(enabled);
      }
      toast({
        title: enabled ? "Тестовый режим включен" : "Тестовый режим выключен",
        description: enabled 
          ? "Теперь можно управлять компонентами вручную" 
          : "Система вернулась в автоматический режим"
      });
    } catch (error) {
      console.error('Failed to toggle test mode:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось переключить режим",
        variant: "destructive"
      });
    }
  };

  const handleRelayControl = async (relay: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'CMP', state: boolean) => {
    const isNative = Capacitor.isNativePlatform();
    const service = isNative ? capacitorBluetoothService : bluetoothService;
    
    if (!service.isConnected() && !useMock) {
      return;
    }

    try {
      if (!useMock) {
        await service.controlRelays({ [relay]: state });
      }
      console.log(`Relay ${relay} set to ${state ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.error(`Failed to control relay ${relay}:`, error);
      toast({
        title: "Ошибка управления",
        description: `Не удалось ${state ? 'включить' : 'выключить'} ${relay}`,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const service = isNative ? capacitorBluetoothService : bluetoothService;
    
    // Load diagnostic data
    if (useMock || !service.isConnected()) {
      // Use mock data with correct system type
      setData(service.getMockData(systemType));
      setIsLive(false);
    } else {
      // Request real data from Bluetooth
      service.requestDiagnosticData().then(() => {
        // Ждем получения данных
        setTimeout(() => {
          const liveData = service.getLatestData();
          if (liveData) {
            setData(liveData);
            setIsLive(true);
          } else {
            // Если данные не пришли, используем mock
            setData(service.getMockData(systemType));
            setIsLive(false);
          }
        }, 1000);
      }).catch(error => {
        console.error('Failed to request diagnostic data:', error);
        setData(service.getMockData(systemType));
        setIsLive(false);
      });
    }
  }, [useMock, systemType]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка данных...</p>
      </div>
    );
  }

  const getModeColor = () => {
    switch (data.mode) {
      case 'cooling': return 'bg-primary';
      case 'ventilation': return 'bg-accent';
      case 'standby': return 'bg-muted';
      case 'error': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getModeText = () => {
    switch (data.mode) {
      case 'cooling': return 'Охлаждение';
      case 'ventilation': return 'Вентиляция';
      case 'standby': return 'Ожидание';
      case 'error': return 'Ошибка';
      default: return 'Неизвестно';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-foreground hover:text-primary text-sm sm:text-base px-2 sm:px-4"
            >
              <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Назад</span>
            </Button>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/repair-guide?type=${systemType}`)}
                className="text-xs sm:text-sm px-2 sm:px-3 border-accent text-accent hover:bg-accent/10"
              >
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">База знаний</span>
                <span className="sm:hidden">База</span>
              </Button>
              {isLive && (
                <Badge variant="outline" className="border-success text-success text-[10px] sm:text-xs px-1.5 sm:px-2">
                  <Activity className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 animate-pulse" />
                  <span className="hidden sm:inline">В реальном времени</span>
                  <span className="sm:hidden">Live</span>
                </Badge>
              )}
              <Badge className={`${getModeColor()} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                {getModeText()}
              </Badge>
            </div>
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground text-center">
            {systemType.toUpperCase()} - Диагностика
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Test Mode Control */}
        <TestModeControl 
          systemType={systemType.toUpperCase() as 'SKA' | 'SKE'}
          onTestModeChange={handleTestModeChange}
          onRelayControl={handleRelayControl}
        />

        {/* System Overview */}
        <Card className="p-4 sm:p-6 bg-card border-border animate-fade-in">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 text-foreground">
            <Thermometer className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="text-base sm:text-xl">Общие параметры</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <div className="p-3 sm:p-4 rounded-lg bg-background/50 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Температура воздуха</p>
              <p className="text-lg sm:text-2xl font-mono font-bold text-foreground">{data.T_air.toFixed(1)}°C</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-background/50 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Температура испарителя</p>
              <p className="text-lg sm:text-2xl font-mono font-bold text-foreground">{data.T_isp.toFixed(1)}°C</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-background/50 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Напряжение питания</p>
              <p className="text-lg sm:text-2xl font-mono font-bold text-foreground">{data.U_nap.toFixed(1)}V</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-background/50 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Давление</p>
              <p className="text-lg sm:text-2xl font-mono font-bold text-foreground">{((data.U_davl / 255) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </Card>

        {/* Fans Visual Status */}
        <Card className="p-4 sm:p-6 bg-card border-border animate-fade-in [animation-delay:50ms]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
              <Wind className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span className="text-base sm:text-xl">Вентиляторы</span>
            </h2>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Скорость:</span>
                <Badge variant={data.PWM_spd === 2 ? "default" : "secondary"} className="text-xs">
                  {data.PWM_spd === 2 ? 'Быстро' : 'Медленно'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Активных:</span>
                <Badge variant="outline" className="text-xs">{data.n_V_cnd + data.n_V_isp + data.n_V_cmp}</Badge>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-4 sm:gap-6 md:gap-8 min-w-fit pb-2">
              <div className="flex-shrink-0">
                <FanIndicator 
                  fans={data.condenserFans} 
                  label="Конденсатор" 
                />
                <p className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
                  Активно: {data.n_V_cnd} из {data.kUM1_cnd}
                </p>
              </div>
              <div className="flex-shrink-0">
                <FanIndicator 
                  fans={data.evaporatorFans} 
                  label="Испаритель" 
                />
                <p className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
                  Активно: {data.n_V_isp} из {data.kUM2_isp}
                </p>
              </div>
              <div className="flex-shrink-0">
                <FanIndicator 
                  fans={data.compressorFans} 
                  label="Компрессор" 
                />
                <p className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
                  Активно: {data.n_V_cmp} из {data.kUM3_cmp}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Voltage Drops */}
        <Card className="p-4 sm:p-6 bg-card border-border animate-fade-in [animation-delay:100ms]">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 text-foreground">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
            <span className="text-base sm:text-xl">Просадки напряжения</span>
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            <div className="text-center p-2 sm:p-3 md:p-4 rounded-lg bg-background/50">
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-1 sm:mb-2">dUM1 (Конд.)</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-primary">{data.dUP_M1.toFixed(1)}V</p>
            </div>
            <div className="text-center p-2 sm:p-3 md:p-4 rounded-lg bg-background/50">
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-1 sm:mb-2">dUM2 (Исп.)</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-primary">{data.dUP_M2.toFixed(1)}V</p>
            </div>
            <div className="text-center p-2 sm:p-3 md:p-4 rounded-lg bg-background/50">
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-1 sm:mb-2">dUM3 (Комп.)</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-primary">{data.dUP_M3.toFixed(1)}V</p>
            </div>
          </div>
        </Card>

        {/* Component Status */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:150ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Gauge className="w-6 h-6 text-secondary" />
            Состояние компонентов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 md:col-span-1">
              <ComponentIndicator 
                icon={Gauge}
                label="Компрессор"
                status={data.compressorStatus}
                value={data.obr_COMP ? 'Обрыв' : data.zmk_COMP ? 'Замыкание' : undefined}
              />
              {data.compressorStatus === 'ok' && (
                <div className="mt-2">
                  <SoftStartSignals 
                    signal_SVD={data.signal_SVD}
                    signal_ContactNorm={data.signal_ContactNorm}
                  />
                </div>
              )}
            </div>
            <ComponentIndicator 
              icon={Wind}
              label="Конденсатор"
              status={data.condenserStatus}
              value={data.obr_V_knd1 ? 'Обрыв вент.' : undefined}
            />
            <ComponentIndicator 
              icon={Thermometer}
              label="Испаритель"
              status={data.evaporatorStatus}
              value={data.obr_V_isp1 ? 'Обрыв вент.' : undefined}
            />
            <ComponentIndicator 
              icon={Gauge}
              label="Датчик давления"
              status={data.pressureSensorStatus}
              value={`${((data.U_davl / 255) * 100).toFixed(0)}%`}
            />
            <ComponentIndicator 
              icon={Zap}
              label="Мягкий пуск"
              status={data.softStartStatus}
            />
            <div className="p-4 rounded-lg border-2 border-border bg-background/50">
              <p className="text-sm font-semibold text-white mb-2">Статус системы</p>
              <p className="text-lg font-mono font-bold text-primary">0x{data.sSTATUS.toString(16).toUpperCase().padStart(2, '0')}</p>
            </div>
          </div>
        </Card>

        {/* Voltage Measurements */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:200ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5 text-warning" />
            Токи измерения
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M1</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M1.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M1 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M2</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M2.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M2 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M3</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M3.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M3 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M4</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M4.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M4 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M5</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M5.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M5 / 30) * 100} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Fuses Status */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:250ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5 text-warning" />
            Предохранители
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <FuseIndicator 
              label="Эталон"
              status={data.fuseEtalon}
              code="Pr1"
            />
            <FuseIndicator 
              label="Конденсатор"
              status={data.fuseCondenser}
              code="Pr2"
            />
            <FuseIndicator 
              label="Испаритель"
              status={data.fuseEvaporator}
              code="Pr3"
            />
            <FuseIndicator 
              label="Компрессор"
              status={data.fuseCompressor}
              code="Pr4"
            />
          </div>
        </Card>

        {/* Errors */}
        {data.errors.length > 0 && (
          <Card className="p-6 bg-destructive/10 border-destructive animate-fade-in [animation-delay:300ms]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Ошибки ({data.errors.length})
            </h2>
            <div className="space-y-3">
              {data.errors.map((error, index) => (
                <div key={index} className="p-4 rounded-lg bg-background/50 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <Badge variant="destructive">{error.code}</Badge>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">{error.component}</p>
                      <p className="text-sm text-muted-foreground mb-2">{error.description}</p>
                      <p className="text-sm text-accent">💡 {error.suggestedFix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
      
      <DebugLogPanel />
    </div>
  );
};

export default Diagnostics;
