import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  FileSearch,
  GitCompareArrows,
  Network,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/shared/link-button";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { cn } from "@/lib/utils";

const TRUST_LOGOS = ["Northwind Finance", "Globex Holdings", "Quantum Capital", "Brightline Group", "Marlowe & Co"];

const PROBLEM_STATS = [
  { icon: AlertTriangle, value: "$5.4B", label: "lost to invoice fraud globally each year" },
  { icon: ScanSearch, value: "1 in 20", label: "invoices contains a pricing or duplication error" },
  { icon: TrendingUp, value: "36 hrs", label: "average time finance teams spend manually reviewing invoices weekly" },
  { icon: ShieldCheck, value: "94%", label: "of fraud attempts go undetected by manual review alone" },
];

const HOW_IT_WORKS = [
  {
    icon: Upload,
    title: "Upload",
    description: "Drop in an invoice (PDF or image) along with the relevant purchase order.",
  },
  {
    icon: ScanSearch,
    title: "AI Analysis",
    description: "GenLayer-hosted LLMs extract line items and check them against vendor history and policy.",
  },
  {
    icon: TrendingUp,
    title: "Risk Score & Explanation",
    description: "Every invoice gets an explainable risk score with the specific factors that drove it.",
  },
  {
    icon: Network,
    title: "Decentralized Validation",
    description: "High-risk invoices are submitted to an Intelligent Contract for independent consensus.",
  },
];

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI Anomaly Detection",
    description: "Automatically flags duplicate invoices, price mismatches, and unusual vendor activity.",
  },
  {
    icon: FileSearch,
    title: "Explainable Risk Scoring",
    description: "Every score comes with a transparent breakdown of weighted risk factors, not a black box.",
  },
  {
    icon: BadgeCheck,
    title: "Vendor Reputation",
    description: "Track vendor reliability over time using historical pricing, disputes, and flags.",
  },
  {
    icon: GitCompareArrows,
    title: "Duplicate & PO Matching",
    description: "Cross-reference invoices against purchase orders and prior submissions automatically.",
  },
  {
    icon: Network,
    title: "Decentralized Validation",
    description: "Suspicious invoices get a second opinion from independent validators on GenLayer StudioNet.",
  },
  {
    icon: ScrollText,
    title: "Full Audit Trail",
    description: "Every decision, on-chain or off, is recorded immutably and available for export.",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
          aria-hidden
        />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <Badge variant="outline" className="bg-genlayer/10 text-genlayer border-genlayer/20">
            <Network className="size-3.5" /> Secured by GenLayer Intelligent Contracts
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Trust Every Invoice Before You Pay.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            InvoTrust combines AI-powered anomaly detection with decentralized validation on GenLayer to
            catch fraud, duplicates, and pricing errors before money leaves your account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/signup" size="lg">
              Get started <ArrowRight />
            </LinkButton>
            <LinkButton href="/#how-it-works" variant="outline" size="lg">
              See how it works
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Built for finance teams at
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-medium text-muted-foreground/70">
            {TRUST_LOGOS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Invoice fraud is bigger than most finance teams realize
          </h2>
          <p className="text-muted-foreground">
            Manual review can&apos;t keep up with the volume - or the sophistication - of modern invoice fraud.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM_STATS.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <stat.icon className="size-5 text-destructive" />
                <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex flex-col gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How InvoTrust works</h2>
            <p className="text-muted-foreground">
              From upload to decentralized consensus, every invoice gets the same rigorous review.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to stop invoice fraud
          </h2>
          <p className="text-muted-foreground">
            From AI-driven anomaly detection to decentralized consensus, InvoTrust covers the full review
            lifecycle.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Product preview */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex flex-col gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See it in action</h2>
            <p className="text-muted-foreground">
              A real-time view of invoice risk across your organization, backed by on-chain validation.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-destructive/40" />
                <span className="size-2.5 rounded-full bg-warning/40" />
                <span className="size-2.5 rounded-full bg-success/40" />
              </div>
              <span className="ml-2 text-xs text-muted-foreground">app.invotrust.com/app/dashboard</span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <Card className="sm:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Needs attention</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {[
                    { name: "Quantum Cloud Services", id: "INV-1001", score: 82 },
                    { name: "Northbridge Facilities Group", id: "INV-1005", score: 58 },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.id}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          item.score >= 70
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-warning/10 text-warning border-warning/20",
                        )}
                      >
                        Risk {item.score}
                      </Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg border border-genlayer/20 bg-genlayer/5 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Network className="size-4 text-genlayer" />
                      <span>Validated on GenLayer StudioNet</span>
                    </div>
                    <Badge variant="outline" className="bg-genlayer/10 text-genlayer border-genlayer/20">
                      Confirmed
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Average risk score</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-4">
                  <RiskGauge score={42} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="border-t border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Stop fraud before it costs you.
          </h2>
          <p className="max-w-xl text-primary-foreground/80">
            Join finance teams using InvoTrust to catch errors and fraud before payment - backed by
            decentralized validation you can verify on-chain.
          </p>
          <LinkButton href="/signup" size="lg" variant="secondary">
            Get started <ArrowRight />
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
