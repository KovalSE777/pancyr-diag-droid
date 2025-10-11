import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity, AlertTriangle, Zap, Thermometer, Gauge, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { bluetoothService } from "@/utils/bluetooth";
import { DiagnosticData } from "@/types/bluetooth";
import { FanIndicator } from "@/components/diagnostics/FanIndicator";
import { ComponentIndicator } from "@/components/diagnostics/ComponentIndicator";
import { FuseIndicator } from "@/components/diagnostics/FuseIndicator";

const Diagnostics = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  const systemType = searchParams.get('type') || 'ska';
  const useMock = searchParams.get('mock') === 'true';

  useEffect(() => {
    // Load diagnostic data
    if (useMock || !bluetoothService.isConnected()) {
      // Use mock data
      setData(bluetoothService.getMockData());
      setIsLive(false);
    } else {
      // TODO: Get real data from Bluetooth
      setData(bluetoothService.getMockData());
      setIsLive(true);
    }
  }, [useMock]);

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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="text-foreground hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
            <div className="flex items-center gap-2">
              {isLive && (
                <Badge variant="outline" className="border-success text-success">
                  <Activity className="w-3 h-3 mr-1 animate-pulse" />
                  В реальном времени
                </Badge>
              )}
              <Badge className={getModeColor()}>
                {getModeText()}
              </Badge>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground text-center">
            {data.systemType === 'SKA' ? 'СКА' : 'СКЭ'} - Диагностика
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Fans Visual Status */}
        <Card className="p-6 bg-card border-border animate-fade-in">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground">
            <Wind className="w-6 h-6 text-primary" />
            Вентиляторы
          </h2>
          <div className="space-y-6">
            <FanIndicator 
              fans={data.condenserFans} 
              label="Конденсатор" 
            />
            <FanIndicator 
              fans={data.evaporatorFans} 
              label="Испаритель" 
            />
            <FanIndicator 
              fans={data.compressorFans} 
              label="Компрессор" 
            />
          </div>
        </Card>

        {/* Voltage Drops */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:100ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5 text-warning" />
            Просадки напряжения
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-background/50">
              <p className="text-sm text-muted-foreground mb-2">dUM1 (Конд.)</p>
              <p className="text-3xl font-mono font-bold text-primary">{data.dUP_M1.toFixed(1)}V</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50">
              <p className="text-sm text-muted-foreground mb-2">dUM2 (Исп.)</p>
              <p className="text-3xl font-mono font-bold text-primary">{data.dUP_M2.toFixed(1)}V</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50">
              <p className="text-sm text-muted-foreground mb-2">dUM3 (Комп.)</p>
              <p className="text-3xl font-mono font-bold text-primary">{data.dUP_M3.toFixed(1)}V</p>
            </div>
          </div>
        </Card>

        {/* Component Status */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:200ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Thermometer className="w-6 h-6 text-secondary" />
            Состояние компонентов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ComponentIndicator 
              icon={Gauge}
              label="Компрессор"
              status={data.compressorStatus}
            />
            <ComponentIndicator 
              icon={Wind}
              label="Конденсатор"
              status={data.condenserStatus}
            />
            <ComponentIndicator 
              icon={Thermometer}
              label="Испаритель"
              status={data.evaporatorStatus}
            />
            <ComponentIndicator 
              icon={Gauge}
              label="Датчик давления"
              status={data.pressureSensorStatus}
            />
          </div>
        </Card>

        {/* Voltage Measurements */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:300ms]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5 text-warning" />
            Напряжения
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M1 (Эталон)</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M1.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M1 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M2 (Испаритель)</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M2.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M2 / 30) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">UP_M3 (Компрессор)</span>
                <span className="font-mono font-bold text-foreground">{data.UP_M3.toFixed(1)}V</span>
              </div>
              <Progress value={(data.UP_M3 / 30) * 100} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Fuses Status */}
        <Card className="p-6 bg-card border-border animate-fade-in [animation-delay:400ms]">
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
          <Card className="p-6 bg-destructive/10 border-destructive animate-fade-in [animation-delay:500ms]">
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
    </div>
  );
};

export default Diagnostics;
