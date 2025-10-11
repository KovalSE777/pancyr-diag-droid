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
      case 'ok': return 'text-green-500 border-green-500 bg-green-500/20';
      case 'error': return 'text-red-500 border-red-500 bg-red-500/20 animate-pulse';
      case 'off': return 'text-white border-white bg-white/10';
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
          <p className="font-semibold text-sm text-white">{label}</p>
          <p className="text-xs opacity-75 text-white">{getStatusText()}</p>
        </div>
      </div>
      {value && (
        <p className="text-lg font-mono font-bold mt-2 text-white">{value}</p>
      )}
    </div>
  );
};
