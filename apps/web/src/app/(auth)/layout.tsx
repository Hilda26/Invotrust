import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-6 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <Logo size={28} />
        <span>InvoTrust</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
