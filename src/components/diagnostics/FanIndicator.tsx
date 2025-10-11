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
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-foreground text-center">{label}</h3>
      <div className="w-full flex gap-6 overflow-x-auto pb-2 justify-center">
        {fans.map((fan) => (
          <div key={fan.id} className="flex flex-col items-center space-y-3 min-w-fit">
            <div 
              className={cn(
                "w-40 h-40 rounded-xl border-2 flex items-center justify-center transition-all",
                getStatusBgColor(fan.status)
              )}
            >
              <Fan 
                className={cn(
                  "w-20 h-20 transition-all",
                  getStatusColor(fan.status),
                  fan.status === 'ok' && "animate-spin"
                )} 
                style={fan.status === 'ok' ? { animationDuration: '2s' } : {}}
              />
            </div>
            <p className="text-base font-medium text-foreground">Вентилятор #{fan.id}</p>
            
            {fan.status === 'error' && (
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg w-64">
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
