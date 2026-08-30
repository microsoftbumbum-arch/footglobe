import countries from "world-countries";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[-_]/g, " ")
  .trim()
  .toLowerCase();

const aliases: Record<string, string> = {
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  usa: "US",
  "united states": "US",
  "south korea": "KR",
  "north korea": "KP",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "congo dr": "CD",
  drc: "CD",
  "cape verde": "CV",
  "curacao": "CW",
  "russia": "RU",
  "iran": "IR",
  "syria": "SY",
  "bolivia": "BO",
  "venezuela": "VE",
  "moldova": "MD",
  "tanzania": "TZ",
};

const atlasNames: Record<string, string> = {
  US: "United States of America",
  GB: "United Kingdom",
  CD: "Dem. Rep. Congo",
  CF: "Central African Rep.",
  DO: "Dominican Rep.",
  GQ: "Eq. Guinea",
  KR: "South Korea",
  KP: "North Korea",
  SS: "S. Sudan",
  CZ: "Czechia",
  BA: "Bosnia and Herz.",
  MK: "North Macedonia",
};

export interface CountryMetadata {
  countryCode: string;
  flag: string;
  globeName: string;
  lat: number;
  lng: number;
}

export function getCountryMetadata(nameOrCode: string): CountryMetadata | null {
  const normalized = normalize(nameOrCode);
  const aliasCode = aliases[normalized];
  const country = countries.find((item) =>
    item.cca2 === nameOrCode.toUpperCase() ||
    item.cca3 === nameOrCode.toUpperCase() ||
    item.cca2 === aliasCode ||
    normalize(item.name.common) === normalized ||
    normalize(item.name.official) === normalized ||
    item.altSpellings.some((spelling) => normalize(spelling) === normalized),
  );
  if (!country) return null;
  return {
    countryCode: country.cca2,
    flag: `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/${country.cca2.toLowerCase()}.svg`,
    globeName: atlasNames[country.cca2] ?? country.name.common,
    lat: country.latlng[0],
    lng: country.latlng[1],
  };
}
