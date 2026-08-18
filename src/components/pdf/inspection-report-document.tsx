"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

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
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#6b7280", fontSize: 9 },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  card: { border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 10, marginBottom: 8 },
  badge: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  badgeCompleted: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeInProgress: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeDraft: { backgroundColor: "#f3f4f6", color: "#374151" },
  table: { marginBottom: 8 },
  tableHeader: { flexDirection: "row", borderBottom: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingBottom: 4, borderBottom: 0.5, borderBottomColor: "#f3f4f6" },
  tableCell: { fontSize: 8 },
  damageCard: { border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, marginBottom: 6 },
  damageHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  damageCategory: { fontFamily: "Helvetica-Bold", fontSize: 9, textTransform: "capitalize" },
  damageMeta: { fontSize: 7, color: "#6b7280", textTransform: "capitalize" },
  damageDesc: { fontSize: 8, color: "#374151", marginBottom: 2 },
  damageCost: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#b45309" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoItem: { width: "48%", marginBottom: 8 },
  photoImage: { width: "100%", height: 120, objectFit: "cover", borderRadius: 3 },
  photoLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase", marginTop: 4 },
  sigGrid: { flexDirection: "row", gap: 16 },
  sigItem: { flex: 1, border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8 },
  sigRole: { fontFamily: "Helvetica-Bold", fontSize: 8, textTransform: "capitalize", marginBottom: 2 },
  sigName: { fontSize: 7, color: "#6b7280", marginBottom: 4 },
  sigImage: { width: "100%", height: 40, objectFit: "contain" },
  footer: { borderTop: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 20 },
  footerText: { fontSize: 7, color: "#9ca3af" },
  comparisonRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  comparisonCol: { flex: 1 },
  comparisonLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  comparisonImage: { width: "100%", height: 100, objectFit: "cover", borderRadius: 3 },
  noteBox: { backgroundColor: "#f9fafb", border: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, marginTop: 4 },
  noteText: { fontSize: 8, color: "#374151" },
  separator: { borderBottom: 0.5, borderBottomColor: "#e5e7eb", marginVertical: 8 },
});

type PhotoData = { category: string; url: string; caption?: string | null };
type DamageData = { category: string; description: string; severity: string; location?: string | null; estimatedRepairCost: number; isPreExisting: boolean };
type ItemData = { section: string; label: string; status: string; beforeValue?: string | null; afterValue?: string | null; notes?: string | null };
type SignatureData = { role: string; name: string; dataUrl: string };

export type InspectionReportData = {
  org: { name: string; address?: string | null; phone?: string | null; email?: string | null; currency: string };
  inspection: {
    type: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    mileage?: number | null;
    engineHours?: number | null;
    fuelLevel?: number | null;
    oilLevel?: string | null;
    notes?: string | null;
  };
  rental: { rentalNo: string; customerName: string; assetName: string; assetNo: string };
  items: ItemData[];
  damages: DamageData[];
  photos: PhotoData[];
  signatures: SignatureData[];
  comparison?: { beforePhotos: PhotoData[]; afterPhotos: PhotoData[] } | null;
  generatedAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const style = status === "completed" ? s.badgeCompleted : status === "in_progress" ? s.badgeInProgress : s.badgeDraft;
  return <Text style={[s.badge, style]}>{status.replace("_", " ")}</Text>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MeterRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

export function InspectionReportDocument({ data }: { data: InspectionReportData }) {
  const { org, inspection, rental, items, damages, photos, signatures, comparison, generatedAt } = data;
  const grouped = items.reduce<Record<string, ItemData[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

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
            <Text style={s.docTitle}>Inspection Report</Text>
            <Text style={s.docSubtitle}>{rental.rentalNo} · {inspection.type.toUpperCase()}</Text>
            <View style={{ marginTop: 4, alignItems: "flex-end" }}>
              <StatusBadge status={inspection.status} />
            </View>
          </View>
        </View>

        {/* Rental & Asset Info */}
        <Section title="Details">
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Customer</Text>
                <Text style={s.value}>{rental.customerName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Asset</Text>
                <Text style={s.value}>{rental.assetName}</Text>
                <Text style={s.orgDetail}>{rental.assetNo}</Text>
              </View>
            </View>
            <View style={s.separator} />
            <MeterRow label="Started" value={inspection.startedAt} />
            {inspection.completedAt && <MeterRow label="Completed" value={inspection.completedAt} />}
          </View>
        </Section>

        {/* Meter Readings */}
        <Section title="Meter Readings">
          <View style={s.card}>
            <MeterRow label="Mileage" value={inspection.mileage != null ? String(inspection.mileage) : null} />
            <MeterRow label="Engine hours" value={inspection.engineHours != null ? String(inspection.engineHours) : null} />
            <MeterRow label="Fuel level" value={inspection.fuelLevel != null ? `${inspection.fuelLevel}%` : null} />
            {inspection.oilLevel && <MeterRow label="Oil level" value={inspection.oilLevel} />}
          </View>
        </Section>

        {/* Checklist */}
        {Object.keys(grouped).length > 0 && (
          <Section title="Checklist">
            {Object.entries(grouped).map(([section, sectionItems]) => (
              <View key={section} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
                  {section}
                </Text>
                <View style={s.table}>
                  <View style={s.tableHeader}>
                    <Text style={[s.tableHeaderText, { flex: 2 }]}>ITEM</Text>
                    <Text style={[s.tableHeaderText, { flex: 1, textAlign: "center" }]}>STATUS</Text>
                    <Text style={[s.tableHeaderText, { flex: 1, textAlign: "right" }]}>VALUE</Text>
                  </View>
                  {sectionItems.map((item, i) => (
                    <View key={i} style={s.tableRow}>
                      <Text style={[s.tableCell, { flex: 2 }]}>{item.label}</Text>
                      <Text style={[s.tableCell, { flex: 1, textAlign: "center", textTransform: "capitalize", color: item.status === "ok" ? "#059669" : item.status === "issue" ? "#d97706" : "#dc2626" }]}>
                        {item.status}
                      </Text>
                      <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>
                        {item.afterValue ?? item.beforeValue ?? "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Damages */}
        {damages.length > 0 && (
          <Section title={`Damages (${damages.length})`}>
            {damages.map((d, i) => (
              <View key={i} style={s.damageCard}>
                <View style={s.damageHeader}>
                  <Text style={s.damageCategory}>{d.category}</Text>
                  <Text style={s.damageMeta}>
                    {d.severity} · {d.isPreExisting ? "pre-existing" : "new"}
                  </Text>
                </View>
                <Text style={s.damageDesc}>{d.description}</Text>
                {d.location && <Text style={s.orgDetail}>{d.location}</Text>}
                {d.estimatedRepairCost > 0 && (
                  <Text style={s.damageCost}>Est. repair: {org.currency} {d.estimatedRepairCost.toLocaleString()}</Text>
                )}
              </View>
            ))}
          </Section>
        )}

        {/* Before/After Comparison */}
        {comparison && comparison.beforePhotos.length > 0 && (
          <Section title="Before / After Comparison">
            {comparison.beforePhotos.map((bp, i) => {
              const ap = comparison.afterPhotos.find((p) => p.category === bp.category);
              if (!ap) return null;
              return (
                <View key={i} style={s.comparisonRow}>
                  <View style={s.comparisonCol}>
                    <Text style={s.comparisonLabel}>Handover — {bp.category}</Text>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image style={s.comparisonImage} src={bp.url} />
                  </View>
                  <View style={s.comparisonCol}>
                    <Text style={s.comparisonLabel}>Return — {ap.category}</Text>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image style={s.comparisonImage} src={ap.url} />
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Section title={`Photos (${photos.length})`}>
            <View style={s.photoGrid}>
              {photos.map((p, i) => (
                <View key={i} style={s.photoItem}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.photoImage} src={p.url} />
                  <Text style={s.photoLabel}>{p.category}{p.caption ? ` — ${p.caption}` : ""}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Signatures */}
        {signatures.length > 0 && (
          <Section title="Signatures">
            <View style={s.sigGrid}>
              {signatures.map((sig, i) => (
                <View key={i} style={s.sigItem}>
                  <Text style={s.sigRole}>{sig.role}</Text>
                  <Text style={s.sigName}>{sig.name}</Text>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.sigImage} src={sig.dataUrl} />
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Notes */}
        {inspection.notes && (
          <Section title="Notes">
            <View style={s.noteBox}>
              <Text style={s.noteText}>{inspection.notes}</Text>
            </View>
          </Section>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Generated by {org.name} · Proofica</Text>
          <Text style={s.footerText}>{generatedAt}</Text>
          <Text style={s.footerText}>This document is an official record of asset condition at the time of {inspection.type}.</Text>
        </View>
      </Page>
    </Document>
  );
}
