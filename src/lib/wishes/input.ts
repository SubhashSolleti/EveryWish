import { z } from "zod";
import { OCCASIONS } from "../db/schema";
import { PLACES } from "../schedule/places";

const placeIds = new Set(PLACES.map((p) => p.id));
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const wishInput = z
  .object({
    endpointId: z.uuid({ message: "Choose who receives this wish" }),
    occasion: z.enum(OCCASIONS),
    occasionLabel: z.string().trim().max(60).optional().nullable(),
    message: z.string().trim().min(1, "Write a message").max(4000, "That message is too long"),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    placeIds: z
      .array(z.string().refine((id) => placeIds.has(id), "Unknown place"))
      .min(1, "Choose at least one place"),
    recurrence: z.enum(["once", "yearly"]),
    year: z.number().int().min(2000).max(2200).optional().nullable(),
  })
  .superRefine((w, ctx) => {
    if (w.day > DAYS_IN_MONTH[w.month - 1]) {
      ctx.addIssue({ code: "custom", path: ["day"], message: "That date doesn't exist" });
    }
    if (w.recurrence === "once") {
      if (!w.year) {
        ctx.addIssue({ code: "custom", path: ["year"], message: "Choose a year" });
      } else if (w.month === 2 && w.day === 29 && !isLeapYear(w.year)) {
        ctx.addIssue({ code: "custom", path: ["day"], message: `${w.year} has no February 29` });
      }
    }
    if (w.occasion === "custom" && !w.occasionLabel) {
      ctx.addIssue({ code: "custom", path: ["occasionLabel"], message: "Name the occasion" });
    }
  });

export type WishInput = z.infer<typeof wishInput>;

export const contactInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  phone: z.string().trim().min(1, "Enter a WhatsApp number"),
});

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
