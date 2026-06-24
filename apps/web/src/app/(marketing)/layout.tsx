import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { LinkButton } from "@/components/shared/link-button";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo size={24} />
            <span>InvoTrust</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              Log in
            </LinkButton>
            <LinkButton href="/signup">Get started</LinkButton>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Logo size={24} />
              <span>InvoTrust</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Trust every invoice before you pay - AI-powered fraud detection backed by decentralized
              validation on GenLayer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Product</span>
              <Link href="/#features" className="text-muted-foreground hover:text-foreground">
                Features
              </Link>
              <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground">
                How it works
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Company</span>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                About
              </Link>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Contact
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Legal</span>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 px-6 py-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} InvoTrust. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
