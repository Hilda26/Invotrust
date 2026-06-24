// Approximate exchange rates to USD. Updated periodically - not for financial precision.
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  CHF: 1.12,
  JPY: 0.0067,
  CNY: 0.14,
  INR: 0.012,
  BRL: 0.18,
  MXN: 0.058,
  SGD: 0.74,
  HKD: 0.13,
  NOK: 0.092,
  SEK: 0.093,
  DKK: 0.146,
  NZD: 0.60,
  ZAR: 0.054,
  NGN: 0.00065,
  KES: 0.0077,
};

export function toUSD(amount: number, currency: string): number {
  const rate = FX_TO_USD[currency.toUpperCase()] ?? 1;
  return amount * rate;
}

export function formatUSD(amount: number): string {
  return `~$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
