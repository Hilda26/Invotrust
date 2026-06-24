"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { updateRiskThreshold } from "./actions";

export function RiskThresholdForm({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue);

  return (
    <form action={updateRiskThreshold} className="flex flex-col gap-4 sm:max-w-md">
      <p className="text-sm text-muted-foreground">
        Invoices with a preliminary risk score at or above this threshold are automatically submitted to the
        GenLayer Intelligent Contract for decentralized validation.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <Label>Threshold</Label>
          <span className="font-mono font-medium">{value}</span>
        </div>
        <Slider
          value={[value]}
          onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)}
          max={100}
          step={5}
        />
        <input type="hidden" name="risk_threshold" value={value} />
      </div>
      <div>
        <Button type="submit">Save threshold</Button>
      </div>
    </form>
  );
}
