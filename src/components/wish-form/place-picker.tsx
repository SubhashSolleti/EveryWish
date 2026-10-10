"use client";

import { useState } from "react";
import { PLACES, REGIONS } from "@/lib/schedule/places";

export function PlacePicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const chosen = new Set(selected);
  const allSelected = chosen.size === PLACES.length;
  const q = query.trim().toLowerCase();
  const visible = PLACES.filter((p) => !q || p.label.toLowerCase().includes(q) || p.zone.toLowerCase().includes(q));

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Keep the list's order so previews read west → east consistently.
    onChange(PLACES.filter((p) => next.has(p.id)).map((p) => p.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-xs flex-1"
          placeholder="Search places…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={allSelected}
            onChange={() => onChange(allSelected ? [] : PLACES.map((p) => p.id))}
          />
          Select all {PLACES.length}
        </label>
        {chosen.size > 0 && !allSelected && (
          <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>

      {REGIONS.map((region) => {
        const places = visible.filter((p) => p.region === region);
        if (places.length === 0) return null;
        return (
          <div key={region}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{region}</p>
            <div className="flex flex-wrap gap-2">
              {places.map((p) => {
                const on = chosen.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      on
                        ? "border-accent bg-accent-soft font-medium text-ink"
                        : "border-line bg-surface text-ink hover:border-muted"
                    }`}
                  >
                    <span className="mr-1.5">{p.flag}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <p className="text-sm text-muted">No places match “{query}”.</p>}
    </div>
  );
}
