import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatHex } from "@/utils/hex";

export interface HexFrame {
  direction: 'TX' | 'RX';
  timestamp: number;
  hex: string;
  checksumOk?: boolean;
  description?: string;
}

interface LiveHexMonitorProps {
  frames: HexFrame[];
}

export const LiveHexMonitor = ({ frames }: LiveHexMonitorProps) => {
  const recentFrames = frames.slice(-6); // последние 6 кадров (3 TX + 3 RX)
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    const ms = String(timestamp % 1000).padStart(3, '0');
    return `${time}.${ms}`;
  };
  
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <h3 className="text-sm font-semibold text-foreground">Live HEX поток</h3>
      </div>
      
      <ScrollArea className="h-48">
        <div className="space-y-2 font-mono text-xs">
          {recentFrames.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Нет данных</p>
          ) : (
            recentFrames.map((frame, idx) => (
              <div 
                key={`${frame.timestamp}-${idx}`}
                className={`p-2 rounded border ${
                  frame.direction === 'TX' 
                    ? 'bg-blue-500/10 border-blue-500/30' 
                    : 'bg-green-500/10 border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {frame.direction === 'TX' ? (
                      <ArrowUpRight className="h-3 w-3 text-blue-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                    )}
                    <Badge variant={frame.direction === 'TX' ? 'default' : 'secondary'} className="h-4 text-[10px]">
                      {frame.direction}
                    </Badge>
                    {frame.checksumOk !== undefined && (
                      <Badge 
                        variant={frame.checksumOk ? 'default' : 'destructive'} 
                        className="h-4 text-[10px]"
                      >
                        CHK {frame.checksumOk ? '✓' : '✗'}
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {formatTime(frame.timestamp)}
                  </span>
                </div>
                
                <div className="text-foreground break-all">
                  {formatHex(frame.hex)}
                </div>
                
                {frame.description && (
                  <div className="text-muted-foreground text-[10px] mt-1">
                    {frame.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};