// System types
export type SystemType = 'SKA' | 'SKE';

// Relay types
export type RelayType = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'CMP';

// Component status types
export type ComponentStatus = 'ok' | 'error' | 'off';

export interface FanStatus {
  id: number;
  status: ComponentStatus;
  errorMessage?: string;
  repairHint?: string;
}

export interface DiagnosticData {
  // Voltages (current measurements)
  UP_M1: number;  // Condenser current
  UP_M2: number;  // Evaporator current
  UP_M3: number;  // Compressor current
  UP_M4: number;  // Additional channel
  UP_M5: number;  // Fan power supply
  
  // Voltage drops
  dUP_M1: number;  // Condenser voltage drop
  dUP_M2: number;  // Evaporator voltage drop
  dUP_M3: number;  // Compressor voltage drop
  
  // Temperatures
  T_air: number;     // Air temperature (°C)
  T_isp: number;     // Evaporator temperature (°C)
  T_kmp?: number;    // Compressor temperature (°C)
  
  // System voltages and pressure
  U_nap: number;     // Power supply voltage (V)
  U_davl: number;    // Pressure sensor (analog value)
  
  // Fan counts and detailed status
  kUM1_cnd: number;  // Condenser fan count
  kUM2_isp: number;  // Evaporator fan count
  kUM3_cmp: number;  // Compressor fan count
  
  // Fan counters (actual working fans)
  n_V_cnd: number;   // Active condenser fans
  n_V_isp: number;   // Active evaporator fans
  n_V_cmp: number;   // Active compressor fans
  
  // PWM Speed
  PWM_spd: 1 | 2;    // 1 = slow, 2 = fast
  
  // Detailed fan status for each fan
  condenserFans: FanStatus[];
  evaporatorFans: FanStatus[];
  compressorFans: FanStatus[];
  
  // Component status
  compressorStatus: ComponentStatus;
  condenserStatus: ComponentStatus;
  evaporatorStatus: ComponentStatus;
  pressureSensorStatus: ComponentStatus;
  softStartStatus: ComponentStatus;
  
  // Component detailed diagnostics (zmk/obr - short circuit/break)
  zmk_V_isp1: boolean;  // Evaporator fan 1 short circuit
  obr_V_isp1: boolean;  // Evaporator fan 1 break
  zmk_V_knd1: boolean;  // Condenser fan 1 short circuit
  obr_V_knd1: boolean;  // Condenser fan 1 break
  zmk_COMP: boolean;    // Compressor short circuit
  obr_COMP: boolean;    // Compressor break
  
  // Working modes
  work_rej_cnd: number;  // Condenser mode: 0=off, 1=startup, 2=work, 10=stop
  work_rej_isp: number;  // Evaporator mode
  work_rej_cmp: number;  // Compressor mode
  
  // Fuses status
  fuseEtalon: boolean;    // Pr1
  fuseCondenser: boolean; // Pr2
  fuseEvaporator: boolean;// Pr3
  fuseCompressor: boolean;// Pr4
  
  // Soft start signals (УПП)
  signal_SVD: boolean;     // Signal from photodiode (1st signal)
  signal_ContactNorm: boolean;  // Contact normal signal (2nd signal)
  
  // Cycle counters (from screen 4 protocol)
  cikl_COM: number;        // BT cycle counter
  cikl_K_line: number;     // K-Line cycle counter
  
  // PWM parameters (from screen 4 protocol)
  s1_TMR2: number;         // High level duration
  s0_TMR2: number;         // Low level duration
  
  // Set voltage drops (reference values)
  edlt_cnd_i: number;      // Set condenser voltage drop
  edlt_isp_i: number;      // Set evaporator voltage drop
  edlt_cmp_i: number;      // Set compressor voltage drop
  
  // Timer
  timer_off: number;       // Shutdown timer
  
  // System configuration
  systemType: SystemType;
  mode: 'cooling' | 'ventilation' | 'standby' | 'error';
  
  // System status
  sSTATUS: number;  // Overall system status byte
  
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
