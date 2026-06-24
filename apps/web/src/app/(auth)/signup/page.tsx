"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const WALLET_POLL_ATTEMPTS = 10;
const WALLET_POLL_INTERVAL_MS = 1000;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setCreatingWallet(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding` },
    });

    if (signUpError) {
      setError(signUpError.message);
      setCreatingWallet(false);
      return;
    }

    if (!data.session) {
      // Email confirmation is required before the account becomes active.
      setCreatingWallet(false);
      setConfirmationSent(true);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      for (let attempt = 0; attempt < WALLET_POLL_ATTEMPTS; attempt++) {
        const { data: wallet } = await supabase
          .from("user_wallets_public")
          .select("wallet_address")
          .eq("user_id", userId)
          .maybeSingle();

        if (wallet) break;
        await new Promise((resolve) => setTimeout(resolve, WALLET_POLL_INTERVAL_MS));
      }
    }

    router.push("/onboarding");
  }

  if (confirmationSent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-7 text-primary" />
          </div>
          <div>
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ve sent a confirmation link to <span className="font-medium">{email}</span>. Click
              the link to activate your account and finish setting up your secure wallet.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Didn&apos;t get it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setConfirmationSent(false)}
                className="text-primary hover:underline"
              >
                try again
              </button>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (creatingWallet) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Logo size={28} />
            <Loader2 className="absolute size-14 animate-spin text-primary/30" />
          </div>
          <div>
            <p className="font-medium">Setting up your secure wallet...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;re generating an encrypted wallet that will be used to sign GenLayer validation
              requests on your behalf.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Create your account. A secure wallet will be generated automatically for GenLayer validation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
