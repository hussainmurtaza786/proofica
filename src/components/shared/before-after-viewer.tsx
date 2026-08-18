"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Before/after photo comparison with a draggable divider.
 */
export function BeforeAfterViewer({
  beforeUrl,
  afterUrl,
  beforeLabel = "Handover",
  afterLabel = "Return",
  className,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [open, setOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width || 400);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative select-none overflow-hidden rounded-lg border border-border bg-muted", className)}
        style={{ height: 280, touchAction: "none" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          onMove(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && onMove(e)}
      >
        {/* after (base) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {/* before (clipped) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeUrl}
            alt={beforeLabel}
            className="h-full w-full object-cover"
            style={{ width: containerWidth }}
            draggable={false}
          />
        </div>
        <div className="absolute inset-y-0 flex items-center" style={{ left: `${position}%` }}>
          <div className="h-full w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
          <div className="absolute flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200">
            <span className="text-xs text-slate-500">◂▸</span>
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="grid max-h-[90vh] max-w-4xl grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={beforeUrl} alt={beforeLabel} className="max-h-[85vh] w-full object-contain" />
            </div>
            <div className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={afterUrl} alt={afterLabel} className="max-h-[85vh] w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
