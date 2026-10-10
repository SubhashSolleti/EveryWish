import { getPlace } from "@/lib/schedule/places";

/** "🇺🇸 New York · 🇨🇦 Toronto" */
export function PlaceGroup({ placeIds }: { placeIds: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {placeIds.map((id, i) => {
        const place = getPlace(id);
        return (
          <span key={id} className="whitespace-nowrap">
            {i > 0 && <span className="mr-1.5 text-muted">·</span>}
            <span className="mr-1">{place.flag}</span>
            {place.label}
          </span>
        );
      })}
    </span>
  );
}
