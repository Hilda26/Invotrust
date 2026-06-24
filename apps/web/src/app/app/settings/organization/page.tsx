import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";
import { updateOrganizationName, updateProcurementPolicy } from "./actions";
import { RiskThresholdForm } from "./risk-threshold-form";

export default async function OrganizationSettingsPage() {
  const { orgId } = await getOrgContext();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, risk_threshold, procurement_policy")
    .eq("id", orgId)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:max-w-md">
          <form action={updateOrganizationName} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Organization name</Label>
              <Input id="org-name" name="name" defaultValue={org?.name ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-slug">Slug</Label>
              <Input id="org-slug" defaultValue={org?.slug ?? ""} disabled className="font-mono text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-id">Organization ID</Label>
              <Input id="org-id" defaultValue={org?.id ?? ""} disabled className="font-mono text-xs" />
            </div>
            <div>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskThresholdForm initialValue={org?.risk_threshold ?? 70} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procurement policy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This policy is provided to the GenLayer Intelligent Contract as context when validating invoices.
            Describe approval thresholds, preferred vendors, and any rules that should inform fraud
            assessments.
          </p>
          <form action={updateProcurementPolicy} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="procurement-policy">Policy text</Label>
              <Textarea
                id="procurement-policy"
                name="procurement_policy"
                rows={8}
                defaultValue={org?.procurement_policy ?? ""}
                placeholder="- Purchase orders are required for all invoices above $1,000.&#10;- Vendors must be approved and active before any invoice is paid."
              />
            </div>
            <div>
              <Button type="submit">Save policy</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
