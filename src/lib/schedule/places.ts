/**
 * Curated list of places a wish can be delivered to.
 * Users pick places by name; we only ever store the IANA zone behind them.
 * "Select all" means every place in this list.
 */
export type Place = {
  id: string;
  label: string;
  flag: string;
  zone: string; // IANA time zone id
  region: Region;
};

export const REGIONS = ["Americas", "Europe & Africa", "Middle East & Asia", "Oceania"] as const;
export type Region = (typeof REGIONS)[number];

export const PLACES: Place[] = [
  { id: "hawaii", label: "Hawaii", flag: "🇺🇸", zone: "Pacific/Honolulu", region: "Americas" },
  { id: "alaska", label: "Alaska", flag: "🇺🇸", zone: "America/Anchorage", region: "Americas" },
  { id: "california", label: "California", flag: "🇺🇸", zone: "America/Los_Angeles", region: "Americas" },
  { id: "vancouver", label: "Vancouver", flag: "🇨🇦", zone: "America/Vancouver", region: "Americas" },
  { id: "arizona", label: "Arizona", flag: "🇺🇸", zone: "America/Phoenix", region: "Americas" },
  { id: "denver", label: "Denver", flag: "🇺🇸", zone: "America/Denver", region: "Americas" },
  { id: "texas", label: "Texas", flag: "🇺🇸", zone: "America/Chicago", region: "Americas" },
  { id: "mexico-city", label: "Mexico City", flag: "🇲🇽", zone: "America/Mexico_City", region: "Americas" },
  { id: "new-york", label: "New York", flag: "🇺🇸", zone: "America/New_York", region: "Americas" },
  { id: "toronto", label: "Toronto", flag: "🇨🇦", zone: "America/Toronto", region: "Americas" },
  { id: "sao-paulo", label: "São Paulo", flag: "🇧🇷", zone: "America/Sao_Paulo", region: "Americas" },
  { id: "buenos-aires", label: "Buenos Aires", flag: "🇦🇷", zone: "America/Argentina/Buenos_Aires", region: "Americas" },
  { id: "london", label: "London", flag: "🇬🇧", zone: "Europe/London", region: "Europe & Africa" },
  { id: "dublin", label: "Dublin", flag: "🇮🇪", zone: "Europe/Dublin", region: "Europe & Africa" },
  { id: "lisbon", label: "Lisbon", flag: "🇵🇹", zone: "Europe/Lisbon", region: "Europe & Africa" },
  { id: "paris", label: "Paris", flag: "🇫🇷", zone: "Europe/Paris", region: "Europe & Africa" },
  { id: "berlin", label: "Berlin", flag: "🇩🇪", zone: "Europe/Berlin", region: "Europe & Africa" },
  { id: "amsterdam", label: "Amsterdam", flag: "🇳🇱", zone: "Europe/Amsterdam", region: "Europe & Africa" },
  { id: "lagos", label: "Lagos", flag: "🇳🇬", zone: "Africa/Lagos", region: "Europe & Africa" },
  { id: "cairo", label: "Cairo", flag: "🇪🇬", zone: "Africa/Cairo", region: "Europe & Africa" },
  { id: "johannesburg", label: "Johannesburg", flag: "🇿🇦", zone: "Africa/Johannesburg", region: "Europe & Africa" },
  { id: "istanbul", label: "Istanbul", flag: "🇹🇷", zone: "Europe/Istanbul", region: "Europe & Africa" },
  { id: "nairobi", label: "Nairobi", flag: "🇰🇪", zone: "Africa/Nairobi", region: "Europe & Africa" },
  { id: "riyadh", label: "Riyadh", flag: "🇸🇦", zone: "Asia/Riyadh", region: "Middle East & Asia" },
  { id: "dubai", label: "Dubai", flag: "🇦🇪", zone: "Asia/Dubai", region: "Middle East & Asia" },
  { id: "karachi", label: "Karachi", flag: "🇵🇰", zone: "Asia/Karachi", region: "Middle East & Asia" },
  { id: "india", label: "India", flag: "🇮🇳", zone: "Asia/Kolkata", region: "Middle East & Asia" },
  { id: "sri-lanka", label: "Sri Lanka", flag: "🇱🇰", zone: "Asia/Colombo", region: "Middle East & Asia" },
  { id: "nepal", label: "Nepal", flag: "🇳🇵", zone: "Asia/Kathmandu", region: "Middle East & Asia" },
  { id: "dhaka", label: "Dhaka", flag: "🇧🇩", zone: "Asia/Dhaka", region: "Middle East & Asia" },
  { id: "bangkok", label: "Bangkok", flag: "🇹🇭", zone: "Asia/Bangkok", region: "Middle East & Asia" },
  { id: "singapore", label: "Singapore", flag: "🇸🇬", zone: "Asia/Singapore", region: "Middle East & Asia" },
  { id: "hong-kong", label: "Hong Kong", flag: "🇭🇰", zone: "Asia/Hong_Kong", region: "Middle East & Asia" },
  { id: "shanghai", label: "Shanghai", flag: "🇨🇳", zone: "Asia/Shanghai", region: "Middle East & Asia" },
  { id: "tokyo", label: "Tokyo", flag: "🇯🇵", zone: "Asia/Tokyo", region: "Middle East & Asia" },
  { id: "seoul", label: "Seoul", flag: "🇰🇷", zone: "Asia/Seoul", region: "Middle East & Asia" },
  { id: "perth", label: "Perth", flag: "🇦🇺", zone: "Australia/Perth", region: "Oceania" },
  { id: "sydney", label: "Sydney", flag: "🇦🇺", zone: "Australia/Sydney", region: "Oceania" },
  { id: "auckland", label: "Auckland", flag: "🇳🇿", zone: "Pacific/Auckland", region: "Oceania" },
];

const BY_ID = new Map(PLACES.map((p) => [p.id, p]));

export function getPlace(id: string): Place {
  const place = BY_ID.get(id);
  if (!place) throw new Error(`Unknown place: ${id}`);
  return place;
}
