import { LucideIcon } from "lucide-react";
import { ComponentStatus } from "@/types/bluetooth";
import { cn } from "@/lib/utils";

interface ComponentIndicatorProps {
  icon: LucideIcon;
  label: string;
  status: ComponentStatus;
  value?: string;
}

export const ComponentIndicator = ({ icon: Icon, label, status, value }: ComponentIndicatorProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'ok': return 'text-success border-success/50 bg-success/10';
      case 'error': return 'text-destructive border-destructive/50 bg-destructive/10 animate-pulse';
      case 'off': return 'text-muted-foreground border-muted/50 bg-muted/10';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ok': return 'Работает';
      case 'error': return 'Ошибка';
      case 'off': return 'Выключен';
    }
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border-2 transition-all",
      getStatusColor()
    )}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-6 h-6" />
        <div className="flex-1">
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs opacity-75">{getStatusText()}</p>
        </div>
      </div>
      {value && (
        <p className="text-lg font-mono font-bold mt-2">{value}</p>
      )}
    </div>
  );
};
