import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Zap, Wind, Gauge } from "lucide-react";
import { useState } from "react";

interface RelayState {
  M1: boolean; // Condenser fan 1
  M2: boolean; // Condenser fan 2  
  M3: boolean; // Condenser fan 3
  M4: boolean; // Evaporator fan 1
  M5: boolean; // Evaporator fan 2
  CMP: boolean; // Compressor
}

interface TestModeControlProps {
  systemType: 'SKA' | 'SKE';
  onTestModeChange: (enabled: boolean) => void;
  onRelayControl: (relay: keyof RelayState, state: boolean) => void;
}

export const TestModeControl = ({ 
  systemType, 
  onTestModeChange,
  onRelayControl 
}: TestModeControlProps) => {
  const [testMode, setTestMode] = useState(false);
  const [relays, setRelays] = useState<RelayState>({
    M1: false,
    M2: false,
    M3: false,
    M4: false,
    M5: false,
    CMP: false
  });

  const handleTestModeToggle = (enabled: boolean) => {
    setTestMode(enabled);
    onTestModeChange(enabled);
    
    // Reset all relays when entering/exiting test mode
    if (!enabled) {
      const resetRelays: RelayState = {
        M1: false, M2: false, M3: false, M4: false, M5: false, CMP: false
      };
      setRelays(resetRelays);
      Object.keys(resetRelays).forEach(key => {
        onRelayControl(key as keyof RelayState, false);
      });
    }
  };

  const handleRelayToggle = (relay: keyof RelayState) => {
    const newState = !relays[relay];
    setRelays(prev => ({ ...prev, [relay]: newState }));
    onRelayControl(relay, newState);
  };

  const handleAllOff = () => {
    const allOff: RelayState = {
      M1: false, M2: false, M3: false, M4: false, M5: false, CMP: false
    };
    setRelays(allOff);
    Object.keys(allOff).forEach(key => {
      onRelayControl(key as keyof RelayState, false);
    });
  };

  const handleAllOn = () => {
    const allOn: RelayState = {
      M1: true,
      M2: true,
      M3: systemType === 'SKE', // SKE has 3 condenser fans
      M4: true,
      M5: false, // Usually only 1 evaporator fan
      CMP: true
    };
    setRelays(allOn);
    Object.keys(allOn).forEach(key => {
      onRelayControl(key as keyof RelayState, allOn[key as keyof RelayState]);
    });
  };

  return (
    <Card className="p-6 bg-card border-border animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Режим тестирования</h2>
            <p className="text-sm text-muted-foreground">
              Ручное управление компонентами системы
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {testMode ? 'Активен' : 'Выключен'}
          </span>
          <Switch
            checked={testMode}
            onCheckedChange={handleTestModeToggle}
          />
        </div>
      </div>

      {testMode && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAllOn}
              className="flex-1"
            >
              Все включить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAllOff}
              className="flex-1"
            >
              Все выключить
            </Button>
          </div>

          {/* Condenser Fans (M1, M2, M3) */}
          <div className="p-4 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Wind className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Конденсатор</h3>
              <Badge variant="secondary">
                {systemType === 'SKE' ? '3 вентилятора' : '2 вентилятора'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <RelayControl
                label="M1"
                name="Вент. 1"
                active={relays.M1}
                onToggle={() => handleRelayToggle('M1')}
              />
              <RelayControl
                label="M2"
                name="Вент. 2"
                active={relays.M2}
                onToggle={() => handleRelayToggle('M2')}
              />
              {systemType === 'SKE' && (
                <RelayControl
                  label="M3"
                  name="Вент. 3"
                  active={relays.M3}
                  onToggle={() => handleRelayToggle('M3')}
                />
              )}
            </div>
          </div>

          {/* Evaporator Fans (M4, M5) */}
          <div className="p-4 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Wind className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">Испаритель</h3>
              <Badge variant="secondary">1-2 вентилятора</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <RelayControl
                label="M4"
                name="Вент. 1"
                active={relays.M4}
                onToggle={() => handleRelayToggle('M4')}
              />
              <RelayControl
                label="M5"
                name="Вент. 2"
                active={relays.M5}
                onToggle={() => handleRelayToggle('M5')}
              />
            </div>
          </div>

          {/* Compressor */}
          <div className="p-4 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold text-foreground">Компрессор</h3>
            </div>
            <RelayControl
              label="CMP"
              name="Компрессор"
              active={relays.CMP}
              onToggle={() => handleRelayToggle('CMP')}
            />
          </div>

          {/* Warning */}
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-sm text-warning flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <strong>Внимание:</strong> Используйте тестовый режим только для диагностики!
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

interface RelayControlProps {
  label: string;
  name: string;
  active: boolean;
  onToggle: () => void;
}

const RelayControl = ({ label, name, active, onToggle }: RelayControlProps) => {
  return (
    <button
      onClick={onToggle}
      className={`
        p-4 rounded-lg border-2 transition-all duration-200
        ${active 
          ? 'bg-primary/20 border-primary text-primary' 
          : 'bg-background border-border text-muted-foreground hover:border-primary/50'
        }
      `}
    >
      <div className="text-center">
        <div className="text-xs font-semibold mb-1">{label}</div>
        <div className="text-sm">{name}</div>
        <div className={`text-xs mt-2 font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
          {active ? '● ВКЛ' : '○ ВЫКЛ'}
        </div>
      </div>
    </button>
  );
};
