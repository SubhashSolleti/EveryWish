import type { Occasion } from "./db/schema";

export const OCCASION_META: Record<Occasion, { label: string; emoji: string; yearly: boolean }> = {
  birthday: { label: "Birthday", emoji: "🎂", yearly: true },
  anniversary: { label: "Anniversary", emoji: "💍", yearly: true },
  festival: { label: "Festival", emoji: "🪔", yearly: true },
  "new-year": { label: "New Year", emoji: "🎆", yearly: true },
  valentines: { label: "Valentine's Day", emoji: "💝", yearly: true },
  graduation: { label: "Graduation", emoji: "🎓", yearly: false },
  custom: { label: "Custom", emoji: "✨", yearly: false },
};

export function occasionName(occasion: Occasion, label?: string | null): string {
  return occasion === "custom" && label ? label : OCCASION_META[occasion].label;
}

/** "Sister's Birthday" */
export function wishTitle(contactName: string, occasion: Occasion, label?: string | null): string {
  const possessive = contactName.endsWith("s") ? `${contactName}'` : `${contactName}'s`;
  return `${possessive} ${occasionName(occasion, label)}`;
}
