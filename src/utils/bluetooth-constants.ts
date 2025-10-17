/**
 * Константы для Bluetooth протокола
 */

// Тайминги и интервалы (в миллисекундах)
export const BT_TIMING = {
  // Пауза после подключения перед отправкой первой команды (из документации прошивки)
  CONNECTION_STABILIZATION_DELAY: 200,
  
  // Интервал отправки Tester Present (из документации прошивки)
  TESTER_PRESENT_INTERVAL: 1500,
  
  // Интервал чтения диагностических данных (из документации прошивки)
  PERIODIC_READ_INTERVAL: 1000,
  
  // Интервал опроса данных в UI
  UI_POLLING_INTERVAL: 2000,
  
  // Задержка перед редиректом после успешного подключения
  REDIRECT_DELAY: 1200,
} as const;

// Адреса UDS (согласно ТЗ v1.0 от 17.10.2025)
export const UDS_ADDRESSES = {
  BSKU: 0x2A,          // Адрес БСКУ (обновлено с 0x28)
  TESTER: 0xF1,        // Адрес тестера (обновлено с 0xF0)
  EXPECTED_DST: 0xF1,  // Ожидаемый адрес назначения в ответах
  EXPECTED_SRC: 0x2A,  // Ожидаемый адрес источника в ответах (обновлено с 0x28)
} as const;

// Лимиты хранения данных
export const DATA_LIMITS = {
  MAX_HEX_FRAMES: 100,  // Максимальное количество hex-фреймов в памяти
  MAX_LOG_ENTRIES: 100, // Максимальное количество записей в логе
} as const;

// PIN-код для Bluetooth (из документации)
export const BT_DEFAULT_PIN = '1234';
