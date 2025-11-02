import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity, AlertTriangle, Zap, Thermometer, Gauge, Wind, BookOpen, Bluetooth } from "lucide-react";
import { useEffect, useState } from "react";
import { capacitorBluetoothService } from "@/utils/capacitor-bluetooth";
import { DiagnosticData, RelayType } from "@/types/bluetooth";
import { FanIndicator } from "@/components/diagnostics/FanIndicator";
import { ComponentIndicator } from "@/components/diagnostics/ComponentIndicator";
import { FuseIndicator } from "@/components/diagnostics/FuseIndicator";
import { SoftStartSignals } from "@/components/diagnostics/SoftStartSignals";
import { TestModeControl } from "@/components/diagnostics/TestModeControl";
import { LiveHexMonitor, HexFrame } from "@/components/diagnostics/LiveHexMonitor";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { BT_TIMING } from "@/utils/bluetooth-constants";
import { logService } from "@/utils/log-service";
import patternBg from "@/assets/pattern-bg.jpg";


const Diagnostics = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hexFrames, setHexFrames] = useState<HexFrame[]>([]);
  const [connectionInfo, setConnectionInfo] = useState({
    connected: false,
    lastRequest: '',
    lastResponse: '',
    requestCount: 0,
    responseCount: 0
  });
  const { toast } = useToast();
  
  const systemType = searchParams.get('type') || 'ska';
  const useMock = searchParams.get('mock') === 'true';
  
  const isNative = Capacitor.isNativePlatform();
  const service = capacitorBluetoothService;

  const handleTestModeChange = async (enabled: boolean) => {
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
      logService.error('Test Mode', `Failed to toggle: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "Ошибка",
        description: "Не удалось переключить режим",
        variant: "destructive"
      });
    }
  };

  const handleRelayControl = async (relay: RelayType, state: boolean) => {
    if (!service.isConnected() && !useMock) {
      return;
    }

    try {
      if (!useMock) {
        await service.controlRelays({ [relay]: state });
      }
      logService.success('Relay Control', `${relay} set to ${state ? 'ON' : 'OFF'}`);
    } catch (error) {
      logService.error('Relay Control', `Failed to control ${relay}: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "Ошибка управления",
        description: `Не удалось ${state ? 'включить' : 'выключить'} ${relay}`,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (isNative && !useMock) {
      capacitorBluetoothService.setOnFramesUpdate((frames) => {
        setHexFrames(frames);
      });
      setHexFrames(capacitorBluetoothService.getHexFrames());
    }
    
    if (useMock || !service.isConnected()) {
      setData(service.getMockData(systemType));
      setIsLive(false);
      return;
    }

    let interval: number | undefined;
    
    if (!useMock && service.isConnected()) {
      interval = window.setInterval(() => {
        const liveData = service.getLatestData();
        if (liveData) {
          setData(liveData);
          setIsLive(true);
          setConnectionInfo(prev => ({ 
            ...prev,
            connected: service.isConnected(),
            responseCount: prev.responseCount + 1,
            lastResponse: new Date().toLocaleTimeString()
          }));
        }
      }, BT_TIMING.UI_POLLING_INTERVAL);
    }

    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
    };
  }, [useMock, systemType, service]);

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
    <div className="min-h-screen bg-background relative overflow-hidden pb-24 safe-top safe-bottom">
      {/* Multi-layer Optimized Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-30 bg-cover bg-center will-change-auto" style={{ backgroundImage: `url(${patternBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/90 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      </div>
      
      {/* Subtle glow */}
      <div className="fixed top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Premium Header - Mobile optimized */}
      <header className="glass-header sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-3 safe-top">
          {/* Top Row - Back Button and Actions */}
          <div className="flex items-center justify-between mb-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate(`/system-select?type=${systemType}`)}
              className="text-foreground hover:text-primary hover:bg-primary/10 -ml-2 min-h-[44px]"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              <span className="font-semibold">Назад</span>
            </Button>
            
            <div className="flex items-center gap-2">
              {!useMock && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await capacitorBluetoothService.disconnect();
                    toast({
                      title: "Отключено",
                      description: "Bluetooth соединение разорвано"
                    });
                    navigate(`/bluetooth-connect?type=${systemType}`);
                  }}
                  className="min-h-[40px] shadow-lg"
                >
                  <Bluetooth className="w-4 h-4 mr-2" />
                  <span className="hidden xs:inline">Отключиться</span>
                  <span className="xs:hidden">Выйти</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/repair-guide?type=${systemType}`)}
                className="border-accent/50 text-accent hover:bg-accent/20 hover:border-accent min-h-[40px]"
              >
                <BookOpen className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">База знаний</span>
              </Button>
            </div>
          </div>

          {/* Title and Status Row */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-black gradient-text">
              {systemType.toUpperCase()} Диагностика
            </h1>
            
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isLive && (
                <Badge variant="outline" className="border-success/50 text-success bg-success/10 backdrop-blur-sm min-h-[28px]">
                  <Activity className="w-3 h-3 mr-1 animate-pulse" />
                  <span className="hidden xs:inline">Live</span>
                </Badge>
              )}
              <Badge className={`${getModeColor()} shadow-lg min-h-[28px] px-3`}>
                {getModeText()}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-6 space-y-6 safe-bottom">
        {/* Test Mode Control */}
        <TestModeControl
          systemType={systemType.toUpperCase() as 'SKA' | 'SKE'}
          onTestModeChange={handleTestModeChange}
          onRelayControl={handleRelayControl}
        />

        {/* System Overview - Premium Card */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in">
          <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-primary" />
            </div>
            <span>Общие параметры</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card p-4 rounded-xl text-center hover:bg-primary/5 transition-colors min-h-[100px] flex flex-col justify-center">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Температура воздуха</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-primary">{data.T_air.toFixed(1)}°</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center hover:bg-primary/5 transition-colors min-h-[100px] flex flex-col justify-center">
              <p className="text-xs text-muted-foreground mb-2 font-medium">T. испарителя</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-primary">{data.T_isp.toFixed(1)}°</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center hover:bg-accent/5 transition-colors min-h-[100px] flex flex-col justify-center">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Напряжение</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-accent">{data.U_nap.toFixed(1)}V</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center hover:bg-accent/5 transition-colors min-h-[100px] flex flex-col justify-center">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Давление</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-accent">{data.U_davl.toFixed(1)}</p>
            </div>
          </div>
        </Card>

        {/* Fans Visual Status - Mobile Optimized */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in [animation-delay:50ms]">
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <Wind className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-foreground">Вентиляторы</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="text-muted-foreground">Скорость:</span>
                <Badge variant={data.PWM_spd === 2 ? "default" : "secondary"} className="text-xs">
                  {data.PWM_spd === 2 ? 'Быстро' : 'Медленно'}
                </Badge>
              </div>
              <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="text-muted-foreground">Активных:</span>
                <Badge variant="outline" className="text-xs font-bold">{data.n_V_cnd + data.n_V_isp + data.n_V_cmp}</Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <FanIndicator 
                fans={data.condenserFans} 
                label="Конденсатор" 
              />
              <p className="text-center text-sm text-muted-foreground mt-3 font-medium">
                {data.n_V_cnd} из {data.kUM1_cnd}
              </p>
            </div>
            <div>
              <FanIndicator 
                fans={data.evaporatorFans} 
                label="Испаритель" 
              />
              <p className="text-center text-sm text-muted-foreground mt-3 font-medium">
                {data.n_V_isp} из {data.kUM2_isp}
              </p>
            </div>
            <div>
              <FanIndicator 
                fans={data.compressorFans} 
                label="Компрессор" 
              />
              <p className="text-center text-sm text-muted-foreground mt-3 font-medium">
                {data.n_V_cmp} из {data.kUM3_cmp}
              </p>
            </div>
          </div>
        </Card>

        {/* Voltage Drops - Mobile Friendly */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in [animation-delay:100ms]">
          <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center">
              <Zap className="w-5 h-5 text-warning" />
            </div>
            <span>Просадки напряжения</span>
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center glass-card p-4 rounded-xl hover:bg-warning/5 transition-colors">
              <p className="text-xs text-muted-foreground mb-2 font-medium">dUM1 Конд.</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-warning">{data.dUP_M1.toFixed(1)}</p>
            </div>
            <div className="text-center glass-card p-4 rounded-xl hover:bg-warning/5 transition-colors">
              <p className="text-xs text-muted-foreground mb-2 font-medium">dUM2 Исп.</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-warning">{data.dUP_M2.toFixed(1)}</p>
            </div>
            <div className="text-center glass-card p-4 rounded-xl hover:bg-warning/5 transition-colors">
              <p className="text-xs text-muted-foreground mb-2 font-medium">dUM3 Комп.</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-warning">{data.dUP_M3.toFixed(1)}</p>
            </div>
          </div>
        </Card>

        {/* Component Status - Premium Grid */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in [animation-delay:150ms]">
          <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-secondary" />
            </div>
            <span>Состояние компонентов</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <ComponentIndicator 
                icon={Gauge}
                label="Компрессор"
                status={data.compressorStatus}
                value={data.obr_COMP ? 'Обрыв' : data.zmk_COMP ? 'Замыкание' : undefined}
              />
              {data.compressorStatus === 'ok' && (
                <div className="mt-3">
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
              value={`${data.U_davl.toFixed(1)} bar`}
            />
            <ComponentIndicator 
              icon={Zap}
              label="Питание"
              status={data.powerStatus || 'ok'}
              value={data.powerSupplyOk ? `${data.batteryVoltage?.toFixed(1)}V` : 'Ошибка'}
            />
            <ComponentIndicator 
              icon={Zap}
              label="Мягкий пуск"
              status={data.softStartStatus}
            />
            <div className="glass-card p-5 rounded-xl border-2 border-primary/30 hover:border-primary/50 transition-colors">
              <p className="text-sm font-bold text-muted-foreground mb-2">Статус системы</p>
              <p className="text-2xl font-mono font-black text-primary">0x{data.sSTATUS.toString(16).toUpperCase().padStart(2, '0')}</p>
            </div>
          </div>
        </Card>

        {/* Voltage Measurements - Compact */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in [animation-delay:200ms]">
          <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <span>Токи измерения</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'UP_M1', value: data.UP_M1 },
              { label: 'UP_M2', value: data.UP_M2 },
              { label: 'UP_M3', value: data.UP_M3 },
              { label: 'UP_M4', value: data.UP_M4 },
              { label: 'UP_M5', value: data.UP_M5 }
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground font-medium">{item.label}</span>
                  <span className="font-mono font-bold text-foreground">{item.value.toFixed(1)}V</span>
                </div>
                <Progress value={(item.value / 30) * 100} className="h-2.5" />
              </div>
            ))}
          </div>
        </Card>

        {/* Fuses Status - Touch Friendly */}
        <Card className="premium-card p-5 sm:p-6 animate-fade-in [animation-delay:250ms]">
          <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center">
              <Zap className="w-5 h-5 text-warning" />
            </div>
            <span>Предохранители</span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
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

        {/* Errors - Premium Alert */}
        {data.errors.length > 0 && (
          <Card className="premium-card p-5 sm:p-6 bg-destructive/10 border-destructive/50 animate-fade-in [animation-delay:300ms]">
            <h2 className="text-lg sm:text-xl font-black mb-5 flex items-center gap-2 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span>Ошибки ({data.errors.length})</span>
            </h2>
            <div className="space-y-4">
              {data.errors.map((error, index) => (
                <div key={index} className="glass-card p-5 rounded-xl border-2 border-destructive/20">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <Badge variant="destructive" className="text-sm px-3 py-1 min-h-[28px]">{error.code}</Badge>
                    <div className="flex-1">
                      <p className="font-bold text-foreground mb-2 text-base">{error.component}</p>
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{error.description}</p>
                      <p className="text-sm text-accent font-medium">💡 {error.suggestedFix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Diagnostics;
