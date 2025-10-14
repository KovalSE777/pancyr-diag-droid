/**
 * ADC to physical values conversion tables and interpolation
 * Based on firmware calibration tables
 */

// Температура, вариант A (из D_temp1): ADC -> temp_x10 (°C * 10)
export const TEMP_TABLE_A: [number, number][] = [
  [0x00, 29], [0x01, 29], [0x02, 30], [0x10, 38], [0x17, 40],
  [0x49, 66], [0x6A, 80], [0x85, 95], [0xF0, 155], [0xFF, 165],
];

// Температура, вариант B (из D_temp2)
export const TEMP_TABLE_B: [number, number][] = [
  [0x01, 165], [0x10, 175], [0x20, 185], [0x30, 195], [0x40, 205],
  [0x50, 215], [0x60, 225], [0x70, 235], [0xFF, 250],
];

// Давление (из D_davl): ADC -> P_x10 (дели на 10, чтобы получить бар)
export const PRESS_TABLE: [number, number][] = [
  [0, 0], [19, 1], [30, 3], [107, 15], [224, 34], [250, 38],
];

// Напряжение (из D_napr1): ADC -> условные «вольты» UI
export const VOLT_TABLE: [number, number][] = [
  [0x00, 0], [0x86, 60], [0xB7, 120], [0xDE, 167], [0xFF, 209],
];

/**
 * Linear interpolation function (as in firmware)
 * @param x - ADC value (0..255)
 * @param table - calibration table
 * @returns interpolated value
 */
export function interp8(x: number, table: [number, number][]): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x2, y2] = table[i];
    const [x1, y1] = table[i - 1];
    if (x <= x2) {
      const dy = y2 - y1, dx = x2 - x1;
      return Math.round(y1 + (dx ? (x - x1) * dy / dx : 0));
    }
  }
  return table[table.length - 1][1];
}

/**
 * Convert ADC to temperature using table A (for air/evaporator)
 * @param adc - raw ADC value (0..255)
 * @returns temperature in °C
 */
export const adc8ToTempA = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_A) / 10;

/**
 * Convert ADC to temperature using table B (for compressor)
 * @param adc - raw ADC value (0..255)
 * @returns temperature in °C
 */
export const adc8ToTempB = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_B) / 10;

/**
 * Convert ADC to pressure in bar
 * @param adc - raw ADC value (0..255)
 * @returns pressure in bar
 */
export const adc8ToPressureBar = (adc: number): number => interp8(adc & 0xFF, PRESS_TABLE) / 10;

/**
 * Convert ADC to voltage UI units
 * @param adc - raw ADC value (0..255)
 * @returns voltage in UI units
 */
export const adc8ToVoltUI = (adc: number): number => interp8(adc & 0xFF, VOLT_TABLE);
