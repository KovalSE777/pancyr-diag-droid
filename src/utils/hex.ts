/**
 * Утилиты для работы с hex-строками
 */

/**
 * Конвертирует Uint8Array в hex-строку
 */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Конвертирует hex-строку в Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Форматирует hex-строку с пробелами между байтами
 */
export function formatHex(hex: string): string {
  return hex.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
}

/**
 * Форматирует Uint8Array как hex-строку с пробелами
 */
export function formatBytes(bytes: Uint8Array | number[]): string {
  return formatHex(bytesToHex(bytes));
}
