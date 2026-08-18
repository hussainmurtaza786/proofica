import { fmtDateTime, fmtDate } from "@/lib/dates";
import { convertAmount, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/shared/status-badge";

type ReportData = {
  org: { name: string; address: string | null; phone: string | null; email: string | null; currency: string };
  rental: {
    rentalNo: string;
    status: string;
    startAt: Date;
    expectedReturnAt: Date;
    actualReturnAt: Date | null;
    pricingModel: string;
    rate: unknown;
    quantity: number;
    depositRequired: unknown;
    depositHeld: unknown;
    discount: unknown;
    taxPercent: unknown;
    baseTotal: unknown;
    chargesTotal: unknown;
    taxTotal: unknown;
    totalAmount: unknown;
    amountPaid: unknown;
    balance: unknown;
    notes: string | null;
    createdAt: Date;
    customer: { name: string; customerNo: string; phone: string | null; email: string | null; address: string | null; idType: string | null; idNumber: string | null };
    asset: { name: string; assetNo: string; registrationNumber: string | null };
    payments: { type: string; method: string; amount: unknown; receivedAt: Date; reference: string | null }[];
    charges: { type: string; description: string; amount: unknown }[];
    deposit: { amount: unknown; status: string } | null;
    inspections: { type: string; status: string; performedAt: Date | null }[];
  };
};

export function RentalReport({
  data,
  currencySettings,
}: {
  data: ReportData;
  currencySettings?: { displayCurrency: string | null; displayRate: number };
}) {
  const { org, rental } = data;
  const c = org.currency;
  const { displayCurrency, displayRate } = currencySettings ?? { displayCurrency: null, displayRate: 0 };
  const convert = (v: unknown) => {
    if (displayCurrency && displayRate > 0 && c !== displayCurrency) {
      return ` (${formatMoney(convertAmount(v, displayRate), displayCurrency)})`;
    }
    return "";
  };

  return (
    <div className="space-y-8 print:space-y-6">
      <header className="flex items-start justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          {org.address && <p className="mt-1 text-sm text-muted-foreground">{org.address}</p>}
          <p className="text-sm text-muted-foreground">
            {org.phone} {org.phone && org.email ? "·" : ""} {org.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">Rental Agreement</p>
          <p className="text-sm text-muted-foreground">{rental.rentalNo}</p>
          <p className="text-sm text-muted-foreground">Issued {fmtDate(rental.createdAt)}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section title="Customer">
          <p className="font-medium text-foreground">{rental.customer.name}</p>
          <p className="text-sm text-muted-foreground">{rental.customer.customerNo}</p>
          {rental.customer.phone && <p className="text-sm text-muted-foreground">Phone: {rental.customer.phone}</p>}
          {rental.customer.email && <p className="text-sm text-muted-foreground">Email: {rental.customer.email}</p>}
          {rental.customer.address && <p className="text-sm text-muted-foreground">{rental.customer.address}</p>}
          {rental.customer.idNumber && (
            <p className="text-sm text-muted-foreground">
              {rental.customer.idType ?? "ID"}: {rental.customer.idNumber}
            </p>
          )}
        </Section>

        <Section title="Asset">
          <p className="font-medium text-foreground">{rental.asset.name}</p>
          <p className="text-sm text-muted-foreground">{rental.asset.assetNo}</p>
          {rental.asset.registrationNumber && <p className="text-sm text-muted-foreground">Reg: {rental.asset.registrationNumber}</p>}
        </Section>
      </div>

      <Section title="Rental period">
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Start</p>
            <p className="font-medium text-foreground">{fmtDateTime(rental.startAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected return</p>
            <p className="font-medium text-foreground">{fmtDateTime(rental.expectedReturnAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Actual return</p>
            <p className="font-medium text-foreground">{rental.actualReturnAt ? fmtDateTime(rental.actualReturnAt) : "—"}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <StatusBadge status={rental.status} />
        </div>
      </Section>

      <Section title="Pricing">
        <div className="space-y-1.5 text-sm">
          <Row label="Rate" value={formatMoney(Number(rental.rate), c) + convert(rental.rate)} suffix={` / ${rental.pricingModel}${rental.quantity > 1 ? ` × ${rental.quantity}` : ""}`} />
          <Row label="Base amount" value={formatMoney(Number(rental.baseTotal), c) + convert(rental.baseTotal)} />
          {Number(rental.chargesTotal) > 0 && <Row label="Additional charges" value={formatMoney(Number(rental.chargesTotal), c) + convert(rental.chargesTotal)} />}
          {Number(rental.discount) > 0 && <Row label="Discount" value={`-${formatMoney(Number(rental.discount), c)}${convert(rental.discount)}`} />}
          {Number(rental.taxTotal) > 0 && <Row label={`Tax (${Number(rental.taxPercent)}%)`} value={formatMoney(Number(rental.taxTotal), c) + convert(rental.taxTotal)} />}
          <div className="border-t border-border pt-2">
            <Row label="Total" value={formatMoney(Number(rental.totalAmount), c) + convert(rental.totalAmount)} bold />
          </div>
          <Row label="Amount paid" value={formatMoney(Number(rental.amountPaid), c) + convert(rental.amountPaid)} />
          <Row label="Balance" value={Number(rental.balance) > 0 ? formatMoney(Number(rental.balance), c) + convert(rental.balance) : "Paid in full"} />
          {rental.deposit && (
            <Row
              label="Security deposit"
              value={formatMoney(Number(rental.deposit.amount), c) + convert(rental.deposit.amount)}
              suffix={` (${rental.deposit.status})`}
            />
          )}
        </div>
      </Section>

      {rental.charges.length > 0 && (
        <Section title="Charges">
          <table className="w-full text-sm">
            <tbody>
              {rental.charges.map((ch, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 capitalize text-foreground">{ch.type}</td>
                  <td className="py-1.5 text-muted-foreground">{ch.description}</td>
                  <td className="py-1.5 text-right font-medium text-foreground">
                    {formatMoney(Number(ch.amount), c)}
                    {convert(ch.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {rental.payments.length > 0 && (
        <Section title="Payments received">
          <table className="w-full text-sm">
            <tbody>
              {rental.payments.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 text-muted-foreground">{fmtDate(p.receivedAt)}</td>
                  <td className="py-1.5 capitalize text-foreground">{p.type}</td>
                  <td className="py-1.5 text-muted-foreground">{p.method.replaceAll("_", " ")}</td>
                  <td className="py-1.5 text-right font-medium text-foreground">
                    {formatMoney(Number(p.amount), c)}
                    {convert(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rental.inspections.map((i) => (
          <Section key={i.type} title={`${i.type} inspection`}>
            <p className="text-sm text-muted-foreground">
              Status: <StatusBadge status={i.status} />
            </p>
            {i.performedAt && <p className="mt-1 text-sm text-muted-foreground">{fmtDateTime(i.performedAt)}</p>}
          </Section>
        ))}
        {rental.inspections.length === 0 && (
          <Section title="Inspections">
            <p className="text-sm text-muted-foreground">No inspections recorded.</p>
          </Section>
        )}
      </div>

      {rental.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-sm text-foreground/80">{rental.notes}</p>
        </Section>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          Generated by {org.name} · {rental.rentalNo}
        </p>
        <p>This document is for reference only and does not constitute a legally binding contract unless signed by both parties.</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, suffix, bold }: { label: string; value: string; suffix?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold text-foreground" : "font-medium text-foreground"}>
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );
}
