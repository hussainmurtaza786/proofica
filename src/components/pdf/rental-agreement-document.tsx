"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottom: 1, borderBottomColor: "#e5e7eb", paddingBottom: 16, marginBottom: 20 },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  orgDetail: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  docTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docSubtitle: { fontSize: 8, color: "#6b7280", textAlign: "right", marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", marginBottom: 8 },
  card: { border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 10, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#6b7280", fontSize: 9 },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  grid2: { flexDirection: "row", gap: 12 },
  gridCol: { flex: 1 },
  table: { width: "100%" },
  tableHeader: { flexDirection: "row", borderBottom: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingBottom: 4, borderBottom: 0.5, borderBottomColor: "#f3f4f6" },
  tableCell: { fontSize: 8 },
  separator: { borderBottom: 0.5, borderBottomColor: "#e5e7eb", marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTop: 1, borderTopColor: "#e5e7eb", paddingTop: 6, marginTop: 4 },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  badge: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  noteBox: { backgroundColor: "#f9fafb", border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, marginTop: 4 },
  noteText: { fontSize: 8, color: "#374151" },
  footer: { borderTop: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 20 },
  footerText: { fontSize: 7, color: "#9ca3af" },
  sigSection: { flexDirection: "row", gap: 20, marginTop: 20 },
  sigBlock: { flex: 1, borderTop: 1, borderTopColor: "#d1d5db", paddingTop: 8 },
  sigLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  sigLine: { borderBottom: 0.5, borderBottomColor: "#d1d5db", marginTop: 30, marginBottom: 4 },
  sigName: { fontSize: 8, color: "#374151" },
});

export type RentalAgreementData = {
  org: { name: string; address?: string | null; phone?: string | null; email?: string | null; currency: string };
  rental: {
    rentalNo: string;
    status: string;
    startAt: string;
    expectedReturnAt: string;
    actualReturnAt?: string | null;
    pricingModel: string;
    rate: number;
    quantity: number;
    depositRequired: number;
    depositHeld: number;
    discount: number;
    taxPercent: number;
    baseTotal: number;
    chargesTotal: number;
    taxTotal: number;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    notes?: string | null;
    createdAt: string;
    customer: {
      name: string;
      customerNo: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      idType?: string | null;
      idNumber?: string | null;
      licenseNumber?: string | null;
    };
    asset: {
      name: string;
      assetNo: string;
      registrationNumber?: string | null;
      brand?: string | null;
      model?: string | null;
      year?: number | null;
      color?: string | null;
      category: string;
    };
    payments: { type: string; method: string; amount: number; receivedAt: string }[];
    charges: { type: string; description: string; amount: number; appliedAt: string }[];
    inspections: { type: string; status: string; completedAt?: string | null }[];
  };
  generatedAt: string;
};

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={bold ? s.value : { fontSize: 9 }}>{value}</Text>
    </View>
  );
}

export function RentalAgreementDocument({ data }: { data: RentalAgreementData }) {
  const { org, rental, generatedAt } = data;
  const c = org.currency;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.orgName}>{org.name}</Text>
            {org.address && <Text style={s.orgDetail}>{org.address}</Text>}
            {(org.phone || org.email) && (
              <Text style={s.orgDetail}>
                {org.phone}{org.phone && org.email ? " · " : ""}{org.email}
              </Text>
            )}
          </View>
          <View>
            <Text style={s.docTitle}>Rental Agreement</Text>
            <Text style={s.docSubtitle}>{rental.rentalNo}</Text>
            <Text style={s.docSubtitle}>Issued {rental.createdAt}</Text>
          </View>
        </View>

        {/* Customer & Asset */}
        <View style={s.grid2}>
          <View style={s.gridCol}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Customer</Text>
              <View style={s.card}>
                <Text style={s.value}>{rental.customer.name}</Text>
                <Text style={s.orgDetail}>{rental.customer.customerNo}</Text>
                {rental.customer.phone && <Text style={s.orgDetail}>Phone: {rental.customer.phone}</Text>}
                {rental.customer.email && <Text style={s.orgDetail}>Email: {rental.customer.email}</Text>}
                {rental.customer.address && <Text style={s.orgDetail}>{rental.customer.address}</Text>}
                {rental.customer.idNumber && (
                  <Text style={s.orgDetail}>{rental.customer.idType ?? "ID"}: {rental.customer.idNumber}</Text>
                )}
                {rental.customer.licenseNumber && (
                  <Text style={s.orgDetail}>License: {rental.customer.licenseNumber}</Text>
                )}
              </View>
            </View>
          </View>
          <View style={s.gridCol}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Asset</Text>
              <View style={s.card}>
                <Text style={s.value}>{rental.asset.name}</Text>
                <Text style={s.orgDetail}>{rental.asset.assetNo} · {rental.asset.category}</Text>
                {rental.asset.registrationNumber && <Text style={s.orgDetail}>Reg: {rental.asset.registrationNumber}</Text>}
                {rental.asset.brand && <Text style={s.orgDetail}>Make: {rental.asset.brand} {rental.asset.model ?? ""}</Text>}
                {rental.asset.year && <Text style={s.orgDetail}>Year: {rental.asset.year}</Text>}
                {rental.asset.color && <Text style={s.orgDetail}>Color: {rental.asset.color}</Text>}
              </View>
            </View>
          </View>
        </View>

        {/* Rental Period */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Rental Period</Text>
          <View style={s.card}>
            <View style={s.grid2}>
              <View style={s.gridCol}>
                <Row label="Start" value={rental.startAt} />
                <Row label="Expected return" value={rental.expectedReturnAt} />
              </View>
              <View style={s.gridCol}>
                {rental.actualReturnAt && <Row label="Actual return" value={rental.actualReturnAt} />}
                <Row label="Status" value={rental.status.replace("_", " ")} />
                {rental.quantity > 1 && <Row label="Quantity" value={String(rental.quantity)} />}
              </View>
            </View>
          </View>
        </View>

        {/* Pricing */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pricing</Text>
          <View style={s.card}>
            <Row label="Rate" value={`${c} ${rental.rate.toLocaleString()} / ${rental.pricingModel}${rental.quantity > 1 ? ` × ${rental.quantity}` : ""}`} />
            <Row label="Base amount" value={`${c} ${rental.baseTotal.toLocaleString()}`} />
            {rental.chargesTotal > 0 && <Row label="Additional charges" value={`${c} ${rental.chargesTotal.toLocaleString()}`} />}
            {rental.discount > 0 && <Row label="Discount" value={`-${c} ${rental.discount.toLocaleString()}`} />}
            {rental.taxTotal > 0 && <Row label={`Tax (${rental.taxPercent}%)`} value={`${c} ${rental.taxTotal.toLocaleString()}`} />}
            <View style={s.separator} />
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>{c} {rental.totalAmount.toLocaleString()}</Text>
            </View>
            <Row label="Amount paid" value={`${c} ${rental.amountPaid.toLocaleString()}`} />
            <Row label="Balance" value={rental.balance > 0 ? `${c} ${rental.balance.toLocaleString()}` : "Paid in full"} />
            {rental.depositRequired > 0 && (
              <Row label="Security deposit" value={`${c} ${rental.depositHeld.toLocaleString()} (held)`} />
            )}
          </View>
        </View>

        {/* Charges */}
        {rental.charges.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Charges</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>TYPE</Text>
                <Text style={[s.tableHeaderText, { flex: 2 }]}>DESCRIPTION</Text>
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>AMOUNT</Text>
              </View>
              {rental.charges.map((ch, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={[s.tableCell, { flex: 1, textTransform: "capitalize" }]}>{ch.type}</Text>
                  <Text style={[s.tableCell, { flex: 2 }]}>{ch.description}</Text>
                  <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{c} {ch.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payments */}
        {rental.payments.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Payments Received</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>DATE</Text>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>TYPE</Text>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>METHOD</Text>
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>AMOUNT</Text>
              </View>
              {rental.payments.map((p, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={[s.tableCell, { flex: 1 }]}>{p.receivedAt}</Text>
                  <Text style={[s.tableCell, { flex: 1, textTransform: "capitalize" }]}>{p.type}</Text>
                  <Text style={[s.tableCell, { flex: 1 }]}>{p.method.replace("_", " ")}</Text>
                  <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{c} {p.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Inspections */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Inspections</Text>
          <View style={s.card}>
            {rental.inspections.length === 0 ? (
              <Text style={s.orgDetail}>No inspections recorded.</Text>
            ) : (
              rental.inspections.map((insp, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.label}>{insp.type} inspection</Text>
                  <Text style={s.value}>{insp.status.replace("_", " ")}{insp.completedAt ? ` — ${insp.completedAt}` : ""}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Notes */}
        {rental.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notes</Text>
            <View style={s.noteBox}>
              <Text style={s.noteText}>{rental.notes}</Text>
            </View>
          </View>
        )}

        {/* Signature Lines */}
        <View style={s.sigSection}>
          <View style={s.sigBlock}>
            <Text style={s.sigLabel}>Customer Signature</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{rental.customer.name}</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={s.sigLabel}>Authorized Representative</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{org.name}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Generated by {org.name} · Proofica</Text>
          <Text style={s.footerText}>{generatedAt}</Text>
          <Text style={s.footerText}>This document is for reference only and does not constitute a legally binding contract unless signed by both parties.</Text>
        </View>
      </Page>
    </Document>
  );
}
