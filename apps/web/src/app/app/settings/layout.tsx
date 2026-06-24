import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";

const TABS = [
  { href: "/app/settings/profile", label: "Profile" },
  { href: "/app/settings/wallet", label: "Wallet" },
  { href: "/app/settings/organization", label: "Organization" },
  { href: "/app/settings/members", label: "Members" },
  { href: "/app/settings/genlayer", label: "GenLayer" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your profile, wallet, organization, and integrations." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-48 lg:flex-col">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
