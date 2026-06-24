"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Fuel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WalletAddressChip } from "@/components/shared/wallet-address-chip";
import { createClient } from "@/lib/supabase/client";
import { fetchGenBalance } from "@/lib/genlayer/balance";

export default function WalletSettingsPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [genBalance, setGenBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [step, setStep] = useState<"confirm" | "revealed">("confirm");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    supabase
      .from("user_wallets_public")
      .select("wallet_address")
      .maybeSingle()
      .then(({ data }) => {
        const addr = data?.wallet_address ?? null;
        setWalletAddress(addr);
        if (addr) loadBalance(addr);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBalance(address: string) {
    setBalanceLoading(true);
    setGenBalance(await fetchGenBalance(address));
    setBalanceLoading(false);
  }

  async function handleExport() {
    if (!email) {
      setExportError("Unable to verify current user.");
      return;
    }

    setExporting(true);
    setExportError(null);

    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
    if (reauthError) {
      setExportError("Current password is incorrect.");
      setExporting(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setExportError("Unable to verify your session. Please try again.");
      setExporting(false);
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-private-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      setExportError("Failed to export private key. Please try again.");
      setExporting(false);
      return;
    }

    const result = await response.json();
    setPrivateKey(result.private_key);
    setStep("revealed");
    setExporting(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your wallet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Wallet address</Label>
            {walletAddress ? (
              <WalletAddressChip address={walletAddress} className="w-fit" />
            ) : (
              <p className="text-sm text-muted-foreground">Loading wallet...</p>
            )}
            <p className="text-xs text-muted-foreground">
              This address was generated automatically when your account was created and remains the same
              across all your devices.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>GenLayer StudioNet</Label>
            <div className="flex items-center gap-2 text-sm">
              <Fuel className="size-4 text-genlayer" />
              {balanceLoading ? (
                <span className="text-muted-foreground">Fetching GEN balance...</span>
              ) : genBalance !== null ? (
                <div className="flex items-center gap-3">
                  <span>
                    <span className="font-semibold tabular-nums">{genBalance}</span>
                    <span className="ml-1 text-muted-foreground">GEN</span>
                  </span>
                  {Number(genBalance.replace(/,/g, "")) < 0.01 && (
                    <a
                      href="https://studio.genlayer.com/faucet"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Get GEN from faucet <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  Unable to reach GenLayer StudioNet.{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => walletAddress && loadBalance(walletAddress)}
                  >
                    Retry
                  </button>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export private key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your private key gives full control over this wallet. Export it only to back it up in a secure
            location, such as a password manager or hardware wallet. InvoTrust will never ask for this key.
          </p>
          <Dialog
            onOpenChange={(open) => {
              if (!open) {
                setStep("confirm");
                setPassword("");
                setPrivateKey(null);
                setExportError(null);
              }
            }}
          >
            <DialogTrigger render={<Button variant="outline" className="w-fit" />}>
              Export private key
            </DialogTrigger>
            <DialogContent>
              {step === "confirm" ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Confirm your password</DialogTitle>
                    <DialogDescription>
                      For your security, re-enter your password to export your wallet's private key.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reauth-password">Password</Label>
                    <Input
                      id="reauth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {exportError && <p className="text-sm text-destructive">{exportError}</p>}
                  <DialogFooter>
                    <Button disabled={!password || exporting} onClick={handleExport}>
                      {exporting ? "Verifying..." : "Confirm"}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Your private key</DialogTitle>
                    <DialogDescription>
                      Save this somewhere secure. It will not be shown again.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>Anyone with this key can access and move funds from this wallet. Never share it.</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
                    {privateKey}
                  </div>
                  <DialogFooter>
                    <Button render={<DialogClose />}>I&apos;ve saved it</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
