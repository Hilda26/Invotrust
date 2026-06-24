import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskFactor } from "@/types/domain";

interface ExplainabilityPanelProps {
  reasoning?: string;
  riskFactors?: RiskFactor[];
}

export function ExplainabilityPanel({ reasoning, riskFactors }: ExplainabilityPanelProps) {
  if (!reasoning && !riskFactors?.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          This invoice has not yet been validated by the GenLayer Intelligent Contract. Submit it for
          decentralized validation to see an explainable risk assessment here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reasoning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validator reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{reasoning}</p>
          </CardContent>
        </Card>
      )}

      {riskFactors && riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk factors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {riskFactors.map((factor) => (
                <li key={factor.factor}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{factor.factor.replaceAll("_", " ")}</span>
                    <span className="text-muted-foreground">{Math.round(factor.weight * 100)}% weight</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-genlayer"
                      style={{ width: `${factor.weight * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{factor.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
