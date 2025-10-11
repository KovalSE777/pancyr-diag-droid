import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface FuseIndicatorProps {
  label: string;
  status: boolean;
  code: string;
}

export const FuseIndicator = ({ label, status, code }: FuseIndicatorProps) => {
  return (
    <div className={cn(
      "relative p-4 rounded-lg border-2 transition-all",
      status 
        ? "border-green-500 bg-green-500/20" 
        : "border-red-500 bg-red-500/20 animate-pulse"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-8 rounded-sm",
            status ? "bg-green-500" : "bg-red-500"
          )} />
          <div>
            <p className="text-xs text-muted-foreground">{code}</p>
            <p className="font-semibold text-sm">{label}</p>
          </div>
        </div>
        <Zap className={cn(
          "w-5 h-5",
          status ? "text-green-500" : "text-red-500"
        )} />
      </div>
      {!status && (
        <div className="mt-2 pt-2 border-t border-red-500/20">
          <p className="text-xs text-red-500 font-semibold">⚠️ Перегорел</p>
        </div>
      )}
    </div>
  );
};
