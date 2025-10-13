/**
 * Утилиты для работы с контрольными суммами протокола
 * Согласно документу "Главное.docx" - простая сумма по модулю 256
 */

/**
 * Вычисляет checksum как сумму всех байт по модулю 256
 */
export function calculateChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xFF;
  }
  return sum;
}

/**
 * Проверяет checksum пакета (последний байт должен быть равен сумме предыдущих)
 */
export function verifyChecksum(packet: ArrayLike<number>): boolean {
  if (packet.length < 2) return false;
  
  const expectedChecksum = packet[packet.length - 1];
  const calculatedChecksum = calculateChecksum(Array.from(packet).slice(0, -1));
  
  return expectedChecksum === calculatedChecksum;
}

/**
 * Добавляет checksum к пакету
 */
export function appendChecksum(bytes: number[]): number[] {
  const checksum = calculateChecksum(bytes);
  return [...bytes, checksum];
}

/**
 * Конвертирует байты в HEX строку для отладки
 */
export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}
