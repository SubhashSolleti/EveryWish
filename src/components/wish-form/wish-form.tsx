"use client";

import { useMemo, useState, useTransition } from "react";
import { saveContact, saveWish } from "@/app/actions";
import { OCCASIONS, type Occasion } from "@/lib/db/schema";
import { monthName } from "@/lib/format";
import { OCCASION_META, wishTitle } from "@/lib/occasions";
import type { WishSchedule } from "@/lib/schedule/plan";
import { PlacePicker } from "./place-picker";
import { Preview } from "./preview";

export type ContactOption = { id: string; endpointId: string; name: string; address: string };

export type WishFormValues = {
  endpointId: string;
  occasion: Occasion;
  occasionLabel: string;
  message: string;
  month: number;
  day: number;
  time: string; // "HH:mm"
  recurrence: "once" | "yearly";
  year: number;
  placeIds: string[];
};

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const TIME_PRESETS = [
  { label: "Midnight", value: "00:00" },
  { label: "Morning", value: "08:00" },
  { label: "Noon", value: "12:00" },
  { label: "Evening", value: "19:00" },
];

export function WishForm({
  contacts: initialContacts,
  initial,
  wishId,
  thisYear,
}: {
  contacts: ContactOption[];
  initial: WishFormValues;
  wishId?: string;
  thisYear: number;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [v, setV] = useState(initial);
  const [recurrenceTouched, setRecurrenceTouched] = useState(!!wishId);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof WishFormValues>(key: K, value: WishFormValues[K]) => setV((s) => ({ ...s, [key]: value }));

  const contact = contacts.find((c) => c.endpointId === v.endpointId);
  const meta = OCCASION_META[v.occasion];
  const [hour, minute] = v.time.split(":").map(Number);
  const dateValid = v.day <= DAYS_IN_MONTH[v.month - 1];

  const schedule = useMemo<WishSchedule | null>(
    () =>
      dateValid && Number.isFinite(hour)
        ? {
            month: v.month,
            day: v.day,
            hour,
            minute,
            placeIds: v.placeIds,
            recurrence: v.recurrence === "once" ? { kind: "once", year: v.year } : { kind: "yearly" },
          }
        : null,
    [dateValid, hour, minute, v.month, v.day, v.placeIds, v.recurrence, v.year],
  );

  const chooseOccasion = (occasion: Occasion) => {
    setV((s) => ({
      ...s,
      occasion,
      ...(!recurrenceTouched && { recurrence: OCCASION_META[occasion].yearly ? "yearly" : "once" }),
    }));
  };

  const submit = () => {
    setError(null);
    startSaving(async () => {
      const result = await saveWish(wishId ?? null, {
        endpointId: v.endpointId,
        occasion: v.occasion,
        occasionLabel: v.occasion === "custom" ? v.occasionLabel : null,
        message: v.message,
        month: v.month,
        day: v.day,
        hour,
        minute,
        placeIds: v.placeIds,
        recurrence: v.recurrence,
        year: v.recurrence === "once" ? v.year : null,
      });
      if (result?.error) setError(result.error);
    });
  };

  const title = contact
    ? wishTitle(contact.name, v.occasion, v.occasionLabel || null)
    : `${v.occasion === "custom" && v.occasionLabel ? v.occasionLabel : meta.label} wish`;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <Section step={1} title="Who is it for?">
          <RecipientPicker
            contacts={contacts}
            value={v.endpointId}
            onChange={(id) => set("endpointId", id)}
            onCreated={(c) => {
              setContacts((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
              set("endpointId", c.endpointId);
            }}
          />
        </Section>

        <Section step={2} title="What's the occasion?">
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <Chip key={o} on={v.occasion === o} onClick={() => chooseOccasion(o)}>
                {OCCASION_META[o].emoji} {OCCASION_META[o].label}
              </Chip>
            ))}
          </div>
          {v.occasion === "custom" && (
            <input
              className="field mt-3"
              placeholder="Name the occasion, e.g. First day at the new job"
              value={v.occasionLabel}
              onChange={(e) => set("occasionLabel", e.target.value)}
              maxLength={60}
            />
          )}
        </Section>

        <Section step={3} title="Write your message">
          <textarea
            className="field min-h-32 resize-y text-[15px]"
            placeholder="Happy Birthday ❤️ I hope you have an amazing year!"
            value={v.message}
            onChange={(e) => set("message", e.target.value)}
            maxLength={4000}
          />
          <p className="mt-1 text-xs text-muted">The same message is sent each time. It comes from your own WhatsApp.</p>
        </Section>

        <Section step={4} title="When?">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Month</span>
              <select className="field" value={v.month} onChange={(e) => set("month", Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {monthName(i + 1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Day</span>
              <select className="field" value={v.day} onChange={(e) => set("day", Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1} disabled={i + 1 > DAYS_IN_MONTH[v.month - 1]}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            {v.recurrence === "once" && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Year</span>
                <select className="field" value={v.year} onChange={(e) => set("year", Number(e.target.value))}>
                  {[thisYear, thisYear + 1, thisYear + 2].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Local time</span>
              <input
                type="time"
                className="field"
                value={v.time}
                onChange={(e) => e.target.value && set("time", e.target.value)}
                required
              />
            </label>
          </div>
          {!dateValid && <p className="mt-2 text-sm text-bad">That date doesn&apos;t exist.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <Chip key={p.value} on={v.time === p.value} onClick={() => set("time", p.value)} small>
                {p.label}
              </Chip>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={v.recurrence === "yearly"}
              onChange={(e) => {
                setRecurrenceTouched(true);
                set("recurrence", e.target.checked ? "yearly" : "once");
              }}
            />
            Repeat every year
          </label>
        </Section>

        <Section
          step={5}
          title="Where in the world?"
          hint="Your wish is sent once in each place you pick, when the local clock there reaches the time you chose."
        >
          <PlacePicker selected={v.placeIds} onChange={(ids) => set("placeIds", ids)} />
        </Section>
      </div>

      <aside className="card flex flex-col gap-5 p-5 lg:sticky lg:top-20 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
        <Preview schedule={schedule} title={title} emoji={meta.emoji} message={v.message} />
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <button
          type="button"
          className="btn btn-primary w-full py-3"
          onClick={submit}
          disabled={saving || !v.endpointId || !v.message.trim() || v.placeIds.length === 0 || !dateValid}
        >
          {saving ? "Saving…" : wishId ? "Save changes" : "Schedule wish"}
        </button>
      </aside>
    </div>
  );
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
          {step}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({
  on,
  onClick,
  small,
  children,
}: {
  on: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border transition-colors ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
        on ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

function RecipientPicker({
  contacts,
  value,
  onChange,
  onCreated,
}: {
  contacts: ContactOption[];
  value: string;
  onChange: (endpointId: string) => void;
  onCreated: (c: ContactOption) => void;
}) {
  const [adding, setAdding] = useState(contacts.length === 0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      setError(null);
      const result = await saveContact(null, { name, phone });
      if (result.error) return setError(result.error);
      if (result.contact) {
        onCreated(result.contact);
        setAdding(false);
        setName("");
        setPhone("");
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contacts.map((c) => (
            <Chip key={c.endpointId} on={c.endpointId === value} onClick={() => onChange(c.endpointId)}>
              {c.name} <span className="text-muted">· {c.address}</span>
            </Chip>
          ))}
          {!adding && (
            <button
              type="button"
              className="rounded-full border border-dashed border-line px-3.5 py-1.5 text-sm text-muted hover:text-ink"
              onClick={() => setAdding(true)}
            >
              + Someone new
            </button>
          )}
        </div>
      )}
      {adding && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="field min-w-36 flex-1"
              placeholder="Name, e.g. Sister"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="field min-w-44 flex-1"
              placeholder="WhatsApp number, e.g. +1 415 555 0123"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary py-2" onClick={add} disabled={pending || !name || !phone}>
              {pending ? "Adding…" : "Add"}
            </button>
            {contacts.length > 0 && (
              <button type="button" className="btn btn-ghost py-2" onClick={() => setAdding(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
