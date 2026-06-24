import { Badge } from "@/components/ui/badge";
import { riskBand } from "@/types/domain";

const BAND_STYLES: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const BAND_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function RiskBadge({ score }: { score: number }) {
  const band = riskBand(score);
  return (
    <Badge variant="outline" className={BAND_STYLES[band]}>
      {BAND_LABEL[band]} risk &middot; {Math.round(score)}
    </Badge>
  );
}
