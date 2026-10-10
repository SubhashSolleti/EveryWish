"use client";

import Link from "next/link";
import { useTransition } from "react";
import { cancelWishAction } from "@/app/actions";

export function WishActions({ wishId, active }: { wishId: string; active: boolean }) {
  const [pending, start] = useTransition();

  const cancel = () => {
    if (!confirm("Cancel this wish? Nothing more will be sent.")) return;
    start(async () => {
      const result = await cancelWishAction(wishId);
      if (result.error) alert(result.error);
    });
  };

  const link = "rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/wishes/${wishId}/edit`} className={link}>
        {active ? "Edit" : "Edit & reschedule"}
      </Link>
      <Link href={`/wishes/new?from=${wishId}`} className={link}>
        Duplicate
      </Link>
      <Link href={`/wishes/${wishId}`} className={link}>
        History
      </Link>
      {active && (
        <button onClick={cancel} disabled={pending} className={`${link} hover:text-bad`}>
          {pending ? "Cancelling…" : "Cancel"}
        </button>
      )}
    </div>
  );
}
