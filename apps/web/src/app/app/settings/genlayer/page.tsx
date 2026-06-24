import { CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS ?? null;
const STUDIONET_EXPLORER = CONTRACT_ADDRESS
  ? `https://studio.genlayer.com/contracts/${CONTRACT_ADDRESS}`
  : null;

export default function GenLayerSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">InvoiceValidator contract</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Contract address</span>
            {CONTRACT_ADDRESS ? (
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{CONTRACT_ADDRESS}</code>
                {STUDIONET_EXPLORER && (
                  <a href={STUDIONET_EXPLORER} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="size-7">
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            ) : (
              <div>
                <Badge variant="outline">Not configured</Badge>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Network</span>
            <div>
              <Badge variant="outline" className="bg-genlayer/10 text-genlayer border-genlayer/20">
                GenLayer StudioNet
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Status</span>
            {CONTRACT_ADDRESS ? (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" />
                <span>
                  Contract deployed. Invoices above your risk threshold are submitted automatically for
                  decentralized validation.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  The InvoiceValidator contract has not been deployed yet. Set{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">GENLAYER_CONTRACT_ADDRESS</code>{" "}
                  in your environment to enable on-chain validation.
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How validation works</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            When an invoice exceeds your organization&apos;s risk threshold, InvoTrust submits it to the
            InvoiceValidator Intelligent Contract on GenLayer StudioNet, signed by your own wallet.
          </p>
          <p>
            A panel of validator nodes independently runs the same non-deterministic analysis - checking
            vendor history, line item pricing, duplicate detection, and document consistency - then reach
            consensus on a final decision through GenLayer&apos;s Optimistic Democracy.
          </p>
          <p>
            The result, along with the reasoning from each validator, is written immutably to the contract
            and synced back to your audit log every two minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
