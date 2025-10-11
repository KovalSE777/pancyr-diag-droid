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
        ? "border-success/50 bg-success/10" 
        : "border-destructive/50 bg-destructive/10 animate-pulse"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-8 rounded-sm",
            status ? "bg-success" : "bg-destructive"
          )} />
          <div>
            <p className="text-xs text-muted-foreground">{code}</p>
            <p className="font-semibold text-sm">{label}</p>
          </div>
        </div>
        <Zap className={cn(
          "w-5 h-5",
          status ? "text-success" : "text-destructive"
        )} />
      </div>
      {!status && (
        <div className="mt-2 pt-2 border-t border-destructive/20">
          <p className="text-xs text-destructive font-semibold">⚠️ Перегорел</p>
        </div>
      )}
    </div>
  );
};
