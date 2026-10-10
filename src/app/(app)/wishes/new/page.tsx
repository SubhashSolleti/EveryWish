import { Suspense } from "react";
import { WishForm } from "@/components/wish-form/wish-form";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getWish } from "@/lib/wishes/queries";
import { blankValues, formContacts, valuesFromWish } from "../form-data";

export default function NewWishPage({ searchParams }: PageProps<"/wishes/new">) {
  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">New wish</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewWish searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewWish({ searchParams }: Pick<PageProps<"/wishes/new">, "searchParams">) {
  const userId = await requireUserId();
  const { from } = await searchParams;
  const contacts = await formContacts(userId);
  const now = new Date();

  // "Duplicate" opens the form pre-filled from an existing wish; nothing is saved until confirmed.
  const source = typeof from === "string" ? await getWish(getDb(), userId, from) : null;
  const initial = source ? valuesFromWish(source, now) : blankValues(contacts, now);

  return (
    <>
      {source && <p className="-mt-4 mb-6 text-sm text-muted">Copied from an existing wish — change anything you like.</p>}
      <WishForm contacts={contacts} initial={initial} thisYear={now.getFullYear()} />
    </>
  );
}
