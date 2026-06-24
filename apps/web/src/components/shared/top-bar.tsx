"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Fuel, LogOut, Settings, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { fetchGenBalance } from "@/lib/genlayer/balance";

interface TopBarProps {
  orgName: string;
  userEmail: string;
}

function initialsOf(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function TopBar({ orgName, userEmail }: TopBarProps) {
  const router = useRouter();
  const [genBalance, setGenBalance] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("user_wallets_public")
      .select("wallet_address")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.wallet_address) {
          fetchGenBalance(data.wallet_address).then(setGenBalance);
        }
      });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          nativeButton={false}
          className="gap-1.5 px-2"
          render={<Link href="/app/settings/organization" />}
        >
          <span className="text-sm font-medium">{orgName}</span>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {genBalance !== null && (
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Fuel className="size-3.5 text-genlayer" />
            <span title="Your wallet's gas balance for signing GenLayer validation transactions">
              <span className="font-medium text-foreground">{genBalance}</span> GEN
            </span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initialsOf(userEmail)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{userEmail}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/app/settings/profile" />}>
              <User className="size-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/app/settings/wallet" />}>
              <Wallet className="size-4" /> Wallet
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/app/settings" />}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
