import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SoftStartSignalsProps {
  signal_SVD: boolean;
  signal_ContactNorm: boolean;
}

export const SoftStartSignals = ({ signal_SVD, signal_ContactNorm }: SoftStartSignalsProps) => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/30 border border-border/50">
      <span className="text-xs text-muted-foreground font-medium">УПП:</span>
      
      {/* Signal 1: SVD */}
      <div className="flex items-center gap-1.5">
        {signal_SVD ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/50" />
        )}
        <span className={cn(
          "text-xs font-medium",
          signal_SVD ? "text-success" : "text-muted-foreground/50"
        )}>
          SVD
        </span>
      </div>

      {/* Arrow */}
      <div className="flex items-center">
        <svg width="16" height="8" viewBox="0 0 16 8" fill="none" className="text-muted-foreground/50">
          <path d="M0 4H14M14 4L11 1M14 4L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Signal 2: Contact Normal */}
      <div className="flex items-center gap-1.5">
        {signal_ContactNorm ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/50" />
        )}
        <span className={cn(
          "text-xs font-medium",
          signal_ContactNorm ? "text-success" : "text-muted-foreground/50"
        )}>
          Контакт
        </span>
      </div>
    </div>
  );
};
