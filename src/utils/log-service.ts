import { DATA_LIMITS } from './bluetooth-constants';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  category: string;
  message: string;
}

class LogService {
  private logs: LogEntry[] = [];
  private maxLogs = DATA_LIMITS.MAX_LOG_ENTRIES;
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(level: LogEntry['level'], category: string, message: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message
    };

    this.logs.push(entry);
    
    // Ограничиваем размер массива логов
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Также логируем в console
    const prefix = `[${category}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'success':
        console.log('✅', prefix, message);
        break;
      default:
        console.log(prefix, message);
    }

    // Уведомляем подписчиков
    this.notifyListeners();
  }

  info(category: string, message: string) {
    this.log('info', category, message);
  }

  warn(category: string, message: string) {
    this.log('warn', category, message);
  }

  error(category: string, message: string) {
    this.log('error', category, message);
  }

  success(category: string, message: string) {
    this.log('success', category, message);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    // Сразу отправляем текущие логи
    listener(this.getLogs());
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const logs = this.getLogs();
    this.listeners.forEach(listener => listener(logs));
  }
}

export const logService = new LogService();
