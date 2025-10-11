export interface DiagnosticData {
  // Voltages
  UP_M1: number;  // Voltage measurement 1
  UP_M2: number;  // Voltage measurement 2 (evaporator)
  UP_M3: number;  // Voltage measurement 3 (compressor)
  UP_M4: number;  // Voltage measurement 4
  UP_M5: number;  // Voltage measurement 5
  
  // Voltage drops
  dUP_M1: number;
  dUP_M2: number;
  dUP_M3: number;
  
  // Fan counts
  kUM1_cnd: number;  // Condenser fan count
  kUM2_isp: number;  // Evaporator fan count
  kUM3_cmp: number;  // Compressor fan count
  
  // Status flags
  compressorActive: boolean;
  condenserActive: boolean;
  evaporatorActive: boolean;
  pressureSensorOk: boolean;
  softStartOk: boolean;
  
  // Fuses status
  fuseEtalon: boolean;  // Pr1
  fuseCondenser: boolean;  // Pr2
  fuseEvaporator: boolean;  // Pr3
  fuseCompressor: boolean;
  
  // System type
  systemType: 'SKA' | 'SKE';  // СКА or СКЭ
  
  // Operation mode
  mode: 'cooling' | 'ventilation' | 'standby' | 'error';
  
  // Error codes
  errors: DiagnosticError[];
}

export interface DiagnosticError {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  component: string;
  description: string;
  suggestedFix: string;
}

export interface BluetoothPacket {
  header: number;  // 0x88
  screen: number;
  length: number;
  data: Uint8Array;
  checksum: number;
}

export interface SystemComponent {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error' | 'offline';
  value?: number;
  unit?: string;
}
