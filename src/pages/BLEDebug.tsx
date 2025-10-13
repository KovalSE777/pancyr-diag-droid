import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Bluetooth, 
  Search, 
  Zap, 
  Info,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BLEDevice {
  deviceId: string;
  name?: string;
  rssi?: number;
  uuids?: string[];
}

interface BLEService {
  uuid: string;
  isPrimary: boolean;
  characteristics?: BLECharacteristic[];
}

interface BLECharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    notify: boolean;
    writeWithoutResponse: boolean;
  };
}

const BLEDebug = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BLEDevice | null>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [services, setServices] = useState<BLEService[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [customServiceUUID, setCustomServiceUUID] = useState('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
  const [customCharUUID, setCustomCharUUID] = useState('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
  const [customCommand, setCustomCommand] = useState('88 F1 02 61 01 ED');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : '📝';
    setDebugLogs(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  const scanDevices = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Ошибка",
        description: "BLE сканирование доступно только на мобильных устройствах",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    setDevices([]);
    addLog('Начало сканирования BLE устройств...');

    try {
      await BleClient.initialize();
      addLog('BLE Client инициализирован', 'success');

      // Scan for all devices
      await BleClient.requestLEScan({}, (result) => {
        const device: BLEDevice = {
          deviceId: result.device.deviceId,
          name: result.device.name,
          rssi: result.rssi,
          uuids: result.uuids
        };
        
        setDevices(prev => {
          const exists = prev.find(d => d.deviceId === device.deviceId);
          if (exists) return prev;
          addLog(`Найдено: ${device.name || device.deviceId} (RSSI: ${device.rssi})`);
          return [...prev, device];
        });
      });

      setTimeout(async () => {
        await BleClient.stopLEScan();
        setIsScanning(false);
        addLog('Сканирование завершено', 'success');
      }, 10000);

    } catch (error) {
      addLog(`Ошибка сканирования: ${error}`, 'error');
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BLEDevice) => {
    addLog(`Подключение к ${device.name || device.deviceId}...`);
    
    try {
      await BleClient.connect(device.deviceId, () => {
        addLog(`Устройство ${device.name} отключено`, 'error');
        setConnectedDeviceId(null);
        setServices([]);
      });
      
      setConnectedDeviceId(device.deviceId);
      setSelectedDevice(device);
      addLog(`Подключено к ${device.name || device.deviceId}`, 'success');
      
      // Discover services
      await discoverServices(device.deviceId);
      
    } catch (error) {
      addLog(`Ошибка подключения: ${error}`, 'error');
    }
  };

  const discoverServices = async (deviceId: string) => {
    addLog('Поиск сервисов и характеристик...');
    
    try {
      const discoveredServices = await BleClient.getServices(deviceId);
      addLog(`Найдено сервисов: ${discoveredServices.length}`, 'success');
      
      const servicesWithChars: BLEService[] = [];
      
      for (const service of discoveredServices) {
        addLog(`Сервис: ${service.uuid}`);
        
        const characteristics: BLECharacteristic[] = service.characteristics.map(char => ({
          uuid: char.uuid,
          properties: {
            read: char.properties.read,
            write: char.properties.write,
            notify: char.properties.notify,
            writeWithoutResponse: char.properties.writeWithoutResponse
          }
        }));
        
        servicesWithChars.push({
          uuid: service.uuid,
          isPrimary: true,
          characteristics
        });
        
        characteristics.forEach(char => {
          const props = [];
          if (char.properties.read) props.push('READ');
          if (char.properties.write) props.push('WRITE');
          if (char.properties.notify) props.push('NOTIFY');
          if (char.properties.writeWithoutResponse) props.push('WRITE_NO_RESP');
          addLog(`  └─ Характеристика: ${char.uuid} [${props.join(', ')}]`);
        });
      }
      
      setServices(servicesWithChars);
      
    } catch (error) {
      addLog(`Ошибка при поиске сервисов: ${error}`, 'error');
    }
  };

  const sendCustomCommand = async () => {
    if (!connectedDeviceId) {
      toast({ title: "Ошибка", description: "Устройство не подключено", variant: "destructive" });
      return;
    }

    try {
      // Parse hex command
      const bytes = customCommand.split(' ').map(hex => parseInt(hex, 16));
      const data = new Uint8Array(bytes);
      const dataView = new DataView(data.buffer);
      
      addLog(`Отправка команды: [${customCommand}]`);
      
      await BleClient.write(
        connectedDeviceId,
        customServiceUUID,
        customCharUUID,
        dataView
      );
      
      addLog('Команда отправлена успешно', 'success');
      
    } catch (error) {
      addLog(`Ошибка отправки: ${error}`, 'error');
    }
  };

  const startNotifications = async (serviceUuid: string, charUuid: string) => {
    if (!connectedDeviceId) return;
    
    try {
      addLog(`Подписка на уведомления: ${charUuid}`);
      
      await BleClient.startNotifications(
        connectedDeviceId,
        serviceUuid,
        charUuid,
        (value) => {
          const bytes = new Uint8Array(value.buffer);
          const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
          addLog(`📥 Получены данные (${bytes.length} байт): ${hex}`, 'success');
        }
      );
      
      addLog('Уведомления активированы', 'success');
      
    } catch (error) {
      addLog(`Ошибка подписки: ${error}`, 'error');
    }
  };

  const toggleService = (uuid: string) => {
    setExpandedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
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
          <h1 className="text-xl font-bold text-foreground">BLE Отладка</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Scanner */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Сканирование устройств</h2>
            </div>
            <Button 
              onClick={scanDevices} 
              disabled={isScanning}
              className="bg-primary hover:bg-primary/90"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Сканирование...
                </>
              ) : (
                <>
                  <Bluetooth className="mr-2 h-4 w-4" />
                  Сканировать
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="h-48 border rounded-md p-4">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет найденных устройств. Нажмите "Сканировать"
              </p>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div 
                    key={device.deviceId}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {device.name || 'Неизвестное устройство'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {device.deviceId}
                      </p>
                      {device.rssi && (
                        <p className="text-xs text-muted-foreground">
                          RSSI: {device.rssi} dBm
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => connectToDevice(device)}
                      disabled={connectedDeviceId === device.deviceId}
                      variant={connectedDeviceId === device.deviceId ? "default" : "outline"}
                    >
                      {connectedDeviceId === device.deviceId ? "Подключено" : "Подключить"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Services and Characteristics */}
        {selectedDevice && services.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                Сервисы устройства: {selectedDevice.name || selectedDevice.deviceId}
              </h2>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {services.map((service) => (
                  <Collapsible
                    key={service.uuid}
                    open={expandedServices.has(service.uuid)}
                    onOpenChange={() => toggleService(service.uuid)}
                  >
                    <Card className="border">
                      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          {expandedServices.has(service.uuid) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-mono text-sm">{service.uuid}</span>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <Separator />
                        <div className="p-3 space-y-2">
                          {service.characteristics?.map((char) => (
                            <div key={char.uuid} className="pl-6 py-2 border-l-2 border-primary/20">
                              <p className="font-mono text-xs mb-1">{char.uuid}</p>
                              <div className="flex gap-2 flex-wrap">
                                {char.properties.read && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded">
                                    READ
                                  </span>
                                )}
                                {char.properties.write && (
                                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-300 rounded">
                                    WRITE
                                  </span>
                                )}
                                {char.properties.notify && (
                                  <>
                                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded">
                                      NOTIFY
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs"
                                      onClick={() => startNotifications(service.uuid, char.uuid)}
                                    >
                                      Подписаться
                                    </Button>
                                  </>
                                )}
                                {char.properties.writeWithoutResponse && (
                                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded">
                                    WRITE_NO_RESP
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Custom Command */}
        {connectedDeviceId && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Отправка команд</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serviceUUID">Service UUID</Label>
                  <Input
                    id="serviceUUID"
                    value={customServiceUUID}
                    onChange={(e) => setCustomServiceUUID(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="charUUID">Characteristic UUID</Label>
                  <Input
                    id="charUUID"
                    value={customCharUUID}
                    onChange={(e) => setCustomCharUUID(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="command">Команда (HEX, разделенные пробелами)</Label>
                <div className="flex gap-2">
                  <Input
                    id="command"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="88 F1 02 61 01 ED"
                    className="font-mono"
                  />
                  <Button onClick={sendCustomCommand}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Примеры: "88 F1 02 61 01 ED" (запрос данных), "88 F1 02 62 10 FC" (тест режим)
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Debug Logs */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Логи отладки</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDebugLogs([])}
            >
              Очистить
            </Button>
          </div>

          <ScrollArea className="h-64 border rounded-md p-4 bg-muted/30">
            <div className="space-y-1 font-mono text-xs">
              {debugLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Логи появятся здесь</p>
              ) : (
                debugLogs.map((log, index) => (
                  <div key={index} className="text-foreground/90">
                    {log}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </main>
    </div>
  );
};

export default BLEDebug;
