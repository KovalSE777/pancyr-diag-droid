import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { logService, LogEntry } from '@/utils/log-service';
import { cn } from '@/lib/utils';

export const DebugLogPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logService.subscribe(setLogs);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Автопрокрутка к последнему логу
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-warning';
      case 'success':
        return 'text-success';
      default:
        return 'text-accent';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return '📝';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-[9999] bg-card/95 border-border backdrop-blur-sm">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-success" />
          <h3 className="text-sm font-semibold text-foreground">Логи отладки Bluetooth</h3>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logService.clear()}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      {isExpanded && (
        <ScrollArea className="h-64" ref={scrollRef}>
          <div className="p-3 space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Логи появятся здесь при работе с Bluetooth
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex gap-2 hover:bg-muted/50 rounded px-2 py-1">
                  <span className="text-muted-foreground shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="shrink-0">
                    {getLevelIcon(log.level)}
                  </span>
                  <span className={cn("font-semibold shrink-0", getLevelColor(log.level))}>
                    [{log.category}]
                  </span>
                  <span className="text-foreground/80 break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
