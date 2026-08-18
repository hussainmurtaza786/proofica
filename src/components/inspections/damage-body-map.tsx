"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type DamagePoint = {
  id: string;
  x: number;
  y: number;
  category: string;
  severity: string;
  description: string;
  isPreExisting: boolean;
};

const SEVERITY_COLORS: Record<string, string> = {
  cosmetic: "#94a3b8",
  minor: "#facc15",
  moderate: "#f97316",
  major: "#ef4444",
  critical: "#7f1d1d",
};

const VEHICLE_PATH = `
  M 50,5
  C 45,5 35,8 30,15
  L 25,25
  C 22,30 20,40 20,50
  L 20,70
  C 20,75 22,78 25,80
  L 30,85
  C 35,90 40,92 50,92
  C 60,92 65,90 70,85
  L 75,80
  C 78,78 80,75 80,70
  L 80,50
  C 80,40 78,30 75,25
  L 70,15
  C 65,8 55,5 50,5
  Z
`;

const GENERATOR_PATH = `
  M 25,10
  L 75,10
  C 80,10 82,12 82,17
  L 82,83
  C 82,88 80,90 75,90
  L 25,90
  C 20,90 18,88 18,83
  L 18,17
  C 18,12 20,10 25,10
  Z
`;

const EQUIPMENT_PATH = `
  M 30,8
  L 70,8
  C 75,8 78,12 78,18
  L 78,45
  L 85,50
  L 85,55
  L 78,55
  L 78,82
  C 78,88 75,92 70,92
  L 30,92
  C 25,92 22,88 22,82
  L 22,55
  L 15,55
  L 15,50
  L 22,45
  L 22,18
  C 22,12 25,8 30,8
  Z
`;

function getOutlinePath(kind: string): string {
  switch (kind) {
    case "vehicle": return VEHICLE_PATH;
    case "generator": return GENERATOR_PATH;
    default: return EQUIPMENT_PATH;
  }
}

function getAnnotations(kind: string): { label: string; x: number; y: number }[] {
  switch (kind) {
    case "vehicle":
      return [
        { label: "Front", x: 50, y: 3 },
        { label: "Rear", x: 50, y: 97 },
        { label: "Left", x: 10, y: 50 },
        { label: "Right", x: 90, y: 50 },
      ];
    case "generator":
      return [
        { label: "Top", x: 50, y: 5 },
        { label: "Front", x: 50, y: 97 },
        { label: "Left", x: 10, y: 50 },
        { label: "Right", x: 90, y: 50 },
      ];
    default:
      return [
        { label: "Top", x: 50, y: 5 },
        { label: "Bottom", x: 50, y: 97 },
        { label: "Left", x: 10, y: 50 },
        { label: "Right", x: 90, y: 50 },
      ];
  }
}

export function DamageBodyMap({
  damages,
  kind = "vehicle",
  editable = false,
  onAddDamage,
}: {
  damages: DamagePoint[];
  kind?: string;
  editable?: boolean;
  onAddDamage?: (x: number, y: number) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const outlinePath = getOutlinePath(kind);
  const annotations = getAnnotations(kind);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!editable || !onAddDamage) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddDamage(Math.round(x), Math.round(y));
  }

  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 100"
        className={cn(
          "w-full max-w-[280px] mx-auto",
          editable && "cursor-crosshair"
        )}
        onClick={handleClick}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-border" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" rx="4" />

        {/* Outline */}
        <path
          d={outlinePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-muted-foreground/50"
        />

        {/* Annotations */}
        {annotations.map((a) => (
          <text
            key={a.label}
            x={a.x}
            y={a.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground/40"
            fontSize="4"
            fontWeight="600"
          >
            {a.label}
          </text>
        ))}

        {/* Damage markers */}
        {damages.map((d) => {
          const color = SEVERITY_COLORS[d.severity] ?? "#94a3b8";
          const isHovered = hovered === d.id;
          return (
            <g key={d.id} onMouseEnter={() => setHovered(d.id)} onMouseLeave={() => setHovered(null)}>
              {/* Pulse ring */}
              <circle
                cx={d.x}
                cy={d.y}
                r={isHovered ? 5 : 3.5}
                fill={color}
                fillOpacity={0.15}
                stroke="none"
              />
              {/* Main dot */}
              <circle
                cx={d.x}
                cy={d.y}
                r={isHovered ? 2.8 : 2}
                fill={color}
                stroke="white"
                strokeWidth="0.8"
              />
              {/* Pre-existing indicator */}
              {d.isPreExisting && (
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={4}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.5"
                  strokeDasharray="1.5,1"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const d = damages.find((dm) => dm.id === hovered);
        if (!d) return null;
        return (
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SEVERITY_COLORS[d.severity] ?? "#94a3b8" }}
              />
              <span className="text-xs font-medium capitalize text-foreground">
                {d.category} — {d.severity}
              </span>
            </div>
            <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">{d.description}</p>
            {d.isPreExisting && (
              <p className="mt-0.5 text-xs text-muted-foreground italic">Pre-existing</p>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      {damages.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {Object.entries(SEVERITY_COLORS).map(([severity, color]) => {
            const count = damages.filter((d) => d.severity === severity).length;
            if (count === 0) return null;
            return (
              <div key={severity} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs capitalize text-muted-foreground">
                  {severity} ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
