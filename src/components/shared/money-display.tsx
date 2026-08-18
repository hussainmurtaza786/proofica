import { cn } from "@/lib/utils";
import { convertAmount, formatMoney } from "@/lib/money";

export function MoneyDisplay({
  value,
  currency = "PKR",
  displayCurrency,
  displayRate,
  className,
  strikethrough,
  negative = false,
}: {
  value: unknown;
  currency?: string;
  displayCurrency?: string | null;
  displayRate?: number;
  className?: string;
  strikethrough?: boolean;
  negative?: boolean;
}) {
  const formatted = formatMoney(value as never, currency);
  const showConverted =
    displayCurrency && displayRate && displayRate > 0 && currency !== displayCurrency;
  const converted = showConverted
    ? formatMoney(convertAmount(value as never, displayRate), displayCurrency)
    : null;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        negative && "text-red-600 dark:text-red-400",
        strikethrough && "line-through text-muted-foreground",
        className
      )}
    >
      {formatted}
      {converted && <span className="text-xs font-normal text-muted-foreground"> ({converted})</span>}
    </span>
  );
}
