import { Suspense } from "react";
import { ContactsManager } from "@/components/contacts-manager";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listContacts } from "@/lib/wishes/queries";

export default function PeoplePage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">People</h1>
      <p className="mb-6 mt-1 text-muted">The people you send wishes to, and their WhatsApp numbers.</p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <People />
      </Suspense>
    </>
  );
}

async function People() {
  const userId = await requireUserId();
  return <ContactsManager contacts={await listContacts(getDb(), userId)} />;
}
