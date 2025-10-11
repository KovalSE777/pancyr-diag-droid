import { Fan } from "lucide-react";
import { FanStatus } from "@/types/bluetooth";
import { cn } from "@/lib/utils";

interface FanIndicatorProps {
  fans: FanStatus[];
  label: string;
}

export const FanIndicator = ({ fans, label }: FanIndicatorProps) => {
  const getStatusColor = (status: FanStatus['status']) => {
    switch (status) {
      case 'ok': return 'text-success';
      case 'error': return 'text-destructive';
      case 'off': return 'text-muted';
    }
  };

  const getStatusBgColor = (status: FanStatus['status']) => {
    switch (status) {
      case 'ok': return 'bg-success/20 border-success/50';
      case 'error': return 'bg-destructive/20 border-destructive/50 animate-pulse';
      case 'off': return 'bg-muted/20 border-muted/50';
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-3">
        {fans.map((fan) => (
          <div key={fan.id} className="space-y-2">
            <div 
              className={cn(
                "w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all",
                getStatusBgColor(fan.status)
              )}
            >
              <Fan 
                className={cn(
                  "w-8 h-8 transition-all",
                  getStatusColor(fan.status),
                  fan.status === 'ok' && "animate-spin"
                )} 
                style={fan.status === 'ok' ? { animationDuration: '2s' } : {}}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">#{fan.id}</p>
            
            {fan.status === 'error' && (
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg max-w-xs">
                <p className="text-sm font-semibold text-destructive mb-1">{fan.errorMessage}</p>
                <p className="text-xs text-muted-foreground">💡 {fan.repairHint}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
