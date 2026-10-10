"use client";

import { useState, useTransition } from "react";
import { deleteContactAction, saveContact } from "@/app/actions";

type Row = { id: string; name: string; address: string; activeWishes: number };

export function ContactsManager({ contacts }: { contacts: Row[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(contacts.length === 0 ? "new" : null);

  return (
    <div className="flex flex-col gap-4">
      <ul className="card divide-y divide-line">
        {contacts.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="p-4">
              <ContactEditor contact={c} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <ContactRow key={c.id} contact={c} onEdit={() => setEditing(c.id)} />
          ),
        )}
        {editing === "new" && (
          <li className="p-4">
            <ContactEditor onDone={() => setEditing(null)} />
          </li>
        )}
        {contacts.length === 0 && editing !== "new" && <li className="p-6 text-center text-muted">No one yet.</li>}
      </ul>
      {editing !== "new" && (
        <button className="btn btn-ghost w-fit" onClick={() => setEditing("new")}>
          + Add someone
        </button>
      )}
    </div>
  );
}

function ContactRow({ contact, onEdit }: { contact: Row; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`Remove ${contact.name}? Their finished and cancelled wishes are removed too.`)) return;
    start(async () => {
      const result = await deleteContactAction(contact.id);
      if (result.error) alert(result.error);
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-medium">{contact.name}</p>
        <p className="text-sm text-muted">
          WhatsApp {contact.address} · {contact.activeWishes} active {contact.activeWishes === 1 ? "wish" : "wishes"}
        </p>
      </div>
      <div className="flex gap-1">
        <button className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink" onClick={onEdit}>
          Edit
        </button>
        <button
          className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-bad"
          onClick={remove}
          disabled={pending}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function ContactEditor({ contact, onDone }: { contact?: Row; onDone: () => void }) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const result = await saveContact(contact?.id ?? null, { name, phone });
      if (result.error) setError(result.error);
      else onDone();
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input className="field min-w-36 flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="field min-w-44 flex-1"
          placeholder="WhatsApp number with country code"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {contact && contact.activeWishes > 0 && (
        <p className="text-xs text-muted">A new number applies to all of {contact.name}&apos;s upcoming deliveries.</p>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary py-2" onClick={save} disabled={pending || !name || !phone}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost py-2" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
