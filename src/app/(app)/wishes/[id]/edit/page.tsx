import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WishForm } from "@/components/wish-form/wish-form";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getWish } from "@/lib/wishes/queries";
import { formContacts, valuesFromWish } from "../../form-data";

export default function EditWishPage({ params }: PageProps<"/wishes/[id]/edit">) {
  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">Edit wish</h1>
      <p className="mb-6 text-sm text-muted">Changes apply to deliveries that haven&apos;t been sent yet.</p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <EditWish params={params} />
      </Suspense>
    </>
  );
}

async function EditWish({ params }: Pick<PageProps<"/wishes/[id]/edit">, "params">) {
  const userId = await requireUserId();
  const { id } = await params;
  const wish = await getWish(getDb(), userId, id);
  if (!wish) notFound();
  const now = new Date();

  return (
    <WishForm
      contacts={await formContacts(userId)}
      initial={valuesFromWish(wish, now)}
      wishId={wish.id}
      thisYear={now.getFullYear()}
    />
  );
}
