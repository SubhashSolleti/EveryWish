import type { Delivery } from "@/lib/db/schema";
import { relative } from "@/lib/format";

const STYLES: Record<Delivery["status"], { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-surface-2 text-muted" },
  sending: { label: "Sending…", className: "bg-accent-soft text-accent" },
  sent: { label: "Sent", className: "bg-ok-soft text-ok" },
  failed: { label: "Failed", className: "bg-bad-soft text-bad" },
  missed: { label: "Missed", className: "bg-bad-soft text-bad" },
  cancelled: { label: "Cancelled", className: "bg-surface-2 text-muted" },
};

const RECEIPTS = { server: "Sent ✓", delivered: "Delivered ✓✓", read: "Read ✓✓" } as const;

export function DeliveryStatus({ delivery, now }: { delivery: Delivery; now: Date }) {
  const style = STYLES[delivery.status];
  const label = delivery.status === "sent" && delivery.receipt ? RECEIPTS[delivery.receipt] : style.label;
  const detail =
    delivery.status === "scheduled"
      ? relative(delivery.dueAt, now)
      : delivery.status === "failed" || delivery.status === "missed"
        ? delivery.lastError
        : null;

  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
        {label}
      </span>
      {detail && <span className="max-w-48 text-xs text-muted">{detail}</span>}
      {delivery.status === "scheduled" && delivery.preflightProblem && (
        <span className="max-w-56 text-xs font-medium text-warn">⚠ {delivery.preflightProblem}</span>
      )}
    </span>
  );
}
