import { Fan } from "lucide-react";
import { FanStatus } from "@/types/bluetooth";
import { cn } from "@/lib/utils";

interface FanIndicatorProps {
  fans: FanStatus[];
  label: string;
  layout?: 'horizontal' | 'vertical';
}

export const FanIndicator = ({ fans, label, layout = 'vertical' }: FanIndicatorProps) => {
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
    <div className="space-y-3 flex flex-col items-center">
      <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground text-center">{label}</h3>
      <div className={cn(
        "gap-2 sm:gap-3 md:gap-4 mx-auto",
        layout === 'horizontal' 
          ? "flex flex-nowrap justify-center items-start"
          : "flex flex-wrap justify-center"
      )}>
        {fans.map((fan) => (
          <div key={fan.id} className="flex flex-col items-center space-y-1.5">
            <div 
              className={cn(
                "w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg border-2 flex items-center justify-center transition-all",
                getStatusBgColor(fan.status)
              )}
            >
              <Fan 
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 transition-all",
                  getStatusColor(fan.status),
                  fan.status === 'ok' && "animate-spin"
                )} 
                style={fan.status === 'ok' ? { animationDuration: '2s' } : {}}
              />
            </div>
            <p className="text-[10px] sm:text-xs md:text-sm font-medium text-foreground">
              #{fan.id}
            </p>
            
            {fan.status === 'error' && (
              <div className="col-span-full mt-2 p-2 sm:p-3 bg-destructive/10 border border-destructive/30 rounded-lg w-full">
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
