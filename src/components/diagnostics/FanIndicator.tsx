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
      case 'off': return 'text-muted-foreground';
    }
  };

  const getStatusBgColor = (status: FanStatus['status']) => {
    switch (status) {
      case 'ok': return 'bg-success/20 border-success';
      case 'error': return 'bg-destructive/20 border-destructive animate-pulse';
      case 'off': return 'bg-muted/20 border-muted';
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground text-center">{label}</h3>
      <div className="w-full flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-2 justify-start sm:justify-center">
        {fans.map((fan) => (
          <div key={fan.id} className="flex flex-col items-center space-y-2 min-w-fit">
            <div 
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg border-2 flex items-center justify-center transition-all",
                getStatusBgColor(fan.status)
              )}
            >
              <Fan 
                className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 transition-all",
                  getStatusColor(fan.status),
                  fan.status === 'ok' && "animate-spin"
                )} 
                style={fan.status === 'ok' ? { animationDuration: '2s' } : {}}
              />
            </div>
            <p className="text-xs sm:text-sm md:text-base font-medium text-foreground whitespace-nowrap">
              Вент. #{fan.id}
            </p>
            
            {fan.status === 'error' && (
              <div className="mt-2 p-2 sm:p-3 bg-destructive/10 border border-destructive/30 rounded-lg w-full max-w-[240px] sm:max-w-xs">
                <p className="text-xs sm:text-sm font-semibold text-destructive mb-1 leading-tight">{fan.errorMessage}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">💡 {fan.repairHint}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
