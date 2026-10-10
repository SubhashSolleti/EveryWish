import { getDb } from "@/lib/db";
import type { Wish } from "@/lib/db/schema";
import { hourMinute } from "@/lib/format";
import { listContacts } from "@/lib/wishes/queries";
import type { ContactOption, WishFormValues } from "@/components/wish-form/wish-form";

export async function formContacts(userId: string): Promise<ContactOption[]> {
  const rows = await listContacts(getDb(), userId);
  return rows.map(({ id, endpointId, name, address }) => ({ id, endpointId, name, address }));
}

export function blankValues(contacts: ContactOption[], now: Date): WishFormValues {
  return {
    endpointId: contacts[0]?.endpointId ?? "",
    occasion: "birthday",
    occasionLabel: "",
    message: "",
    month: now.getMonth() + 1,
    day: now.getDate(),
    time: "00:00",
    recurrence: "yearly",
    year: now.getFullYear(),
    placeIds: [],
  };
}

export function valuesFromWish(wish: Wish, now: Date): WishFormValues {
  return {
    endpointId: wish.endpointId,
    occasion: wish.occasion,
    occasionLabel: wish.occasionLabel ?? "",
    message: wish.message,
    month: wish.month,
    day: wish.day,
    time: hourMinute(wish.hour, wish.minute),
    recurrence: wish.recurrence,
    year: wish.year ?? now.getFullYear(),
    placeIds: wish.placeIds,
  };
}
