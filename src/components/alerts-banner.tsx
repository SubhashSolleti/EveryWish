import Link from "next/link";
import { dismissAlert } from "@/app/actions";
import type { alerts } from "@/lib/db/schema";

type Alert = typeof alerts.$inferSelect;

export function AlertsBanner({ items }: { items: Alert[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-6 flex flex-col gap-2">
      {items.map((a) => (
        <li
          key={a.id}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            a.kind === "preflight" ? "border-warn/30 bg-warn-soft" : "border-bad/30 bg-bad-soft"
          }`}
        >
          <span aria-hidden>{a.kind === "preflight" ? "⚠️" : "❗"}</span>
          <p className="flex-1">
            {a.message}
            {(a.kind === "whatsapp-disconnected" || a.message.includes("WhatsApp is disconnected")) && (
              <>
                {" "}
                <Link href="/whatsapp" className="font-semibold underline">
                  Reconnect
                </Link>
              </>
            )}
          </p>
          <form action={dismissAlert.bind(null, a.id)}>
            <button className="text-xs font-medium text-muted hover:text-ink">Dismiss</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
