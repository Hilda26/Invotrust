"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletAddressChip } from "@/components/shared/wallet-address-chip";
import { createClient } from "@/lib/supabase/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadWallet() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data: wallet } = await supabase
        .from("user_wallets_public")
        .select("wallet_address")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      setWalletAddress(wallet?.wallet_address ?? null);
    }

    loadWallet();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_organization_with_owner", {
      p_name: orgName,
      p_slug: `${slugify(orgName)}-${Math.random().toString(36).slice(2, 8)}`,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your organization</CardTitle>
        <CardDescription>
          This is the workspace your team will use to review invoices and manage vendors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              placeholder="Acme Corp"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Your wallet</span>
            {walletAddress ? (
              <WalletAddressChip address={walletAddress} className="w-fit" />
            ) : (
              <p className="text-xs text-muted-foreground">Generating your wallet...</p>
            )}
            <p className="text-xs text-muted-foreground">
              This wallet was created for you and will sign GenLayer validation requests for your
              organization.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !orgName}>
            {submitting ? "Creating organization..." : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
