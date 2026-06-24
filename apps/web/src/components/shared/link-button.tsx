import Link from "next/link";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({ href, className, variant, size, children }: LinkButtonProps) {
  return (
    <Button nativeButton={false} variant={variant} size={size} className={className} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
