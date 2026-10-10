"use client";

import { useActionState } from "react";
import { login, type ActionResult } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(login, {});

  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <form action={action} className="card flex w-full max-w-sm flex-col gap-4 p-7">
        <div>
          <p className="font-display text-2xl font-semibold">
            Every<span className="text-accent">Wish</span>
          </p>
          <p className="mt-1 text-sm text-muted">Write once. Arrives at midnight, wherever they are.</p>
        </div>
        <input
          name="password"
          type="password"
          className="field"
          placeholder="Password"
          autoComplete="current-password"
          autoFocus
          required
        />
        {state.error && <p className="text-sm text-bad">{state.error}</p>}
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Opening…" : "Open"}
        </button>
      </form>
    </main>
  );
}
