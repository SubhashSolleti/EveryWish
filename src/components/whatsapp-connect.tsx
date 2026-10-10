"use client";

import { useEffect, useState, useTransition } from "react";
import { requestWhatsApp } from "@/app/actions";
import type { WhatsAppStatus } from "@/app/api/whatsapp/route";

export function WhatsAppConnect() {
  const [state, setState] = useState<WhatsAppStatus | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await fetch("/api/whatsapp", { cache: "no-store" }).catch(() => null);
      if (!cancelled && res?.ok) setState(await res.json());
    };
    void poll();
    const id = setInterval(poll, 2_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!state) return <div className="card h-64 animate-pulse bg-surface-2/50" />;

  const act = (request: "pair" | "logout") => start(() => requestWhatsApp(request));

  if (!state.workerOnline) {
    return (
      <Panel icon="🔌" title="The sender isn't running">
        <p>
          EveryWish sends messages from a background process. Start it with <code className="font-mono">npm run worker</code>{" "}
          (or check your server), then this page will update by itself.
        </p>
      </Panel>
    );
  }

  if (state.status === "connected") {
    return (
      <Panel icon="✅" title={`Connected as ${state.phone ?? "your number"}`}>
        <p>Your wishes will be sent from this WhatsApp account. Keep your phone online from time to time so the link stays active.</p>
        <button
          className="btn btn-ghost mt-4"
          disabled={pending}
          onClick={() => confirm("Unlink WhatsApp? Scheduled wishes can't be sent until you reconnect.") && act("logout")}
        >
          Unlink WhatsApp
        </button>
      </Panel>
    );
  }

  if (state.status === "pairing" && state.qr) {
    return (
      <Panel icon="📱" title="Scan with WhatsApp on your phone">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open WhatsApp on your phone</li>
          <li>
            Go to <strong>Settings → Linked devices → Link a device</strong>
          </li>
          <li>Point your phone at this code</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, refreshed every few seconds */}
        <img src={state.qr} alt="WhatsApp pairing QR code" className="mt-5 rounded-2xl bg-white p-2" width={280} height={280} />
      </Panel>
    );
  }

  if (state.status === "connecting" || state.status === "pairing") {
    return (
      <Panel icon="⏳" title="Connecting to WhatsApp…">
        <p>This takes a few seconds.</p>
      </Panel>
    );
  }

  return (
    <Panel icon="💬" title="Connect your WhatsApp">
      <p>
        EveryWish sends wishes from <strong>your own</strong> WhatsApp number, linked like WhatsApp Web. Your contacts see
        the message coming from you.
      </p>
      {state.lastError && <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-bad">{state.lastError}</p>}
      <button className="btn btn-primary mt-4" disabled={pending} onClick={() => act("pair")}>
        Show QR code
      </button>
      <p className="mt-4 text-xs text-muted">
        This uses an unofficial connection to WhatsApp. It works well for personal use, but WhatsApp doesn&apos;t officially
        support it.
      </p>
    </Panel>
  );
}

function Panel({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card max-w-xl p-6 text-sm">
      <p className="text-3xl">{icon}</p>
      <h2 className="mb-2 mt-2 font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
