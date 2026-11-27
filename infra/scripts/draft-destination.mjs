#!/usr/bin/env node
// Drafts a suggested-plan stop from open data, for a person to review (docs/product/research/suggested-plans.md).
//
//   node infra/scripts/draft-destination.mjs "Kyoto" [--lang en]
//
// Reads the city's Wikivoyage page (CC BY-SA) and prints, as JSON, the stop's coordinates and its See / Do / Eat /
// Drink listings that have coordinates, already shaped like the catalog's experience tuples. It never guesses a
// price, a "few people know it" flag or a translation: those are researched and written by a person, with
// sources, before anything goes into `packages/domain/src/suggest/catalog.ts`.

const [, , city, ...rest] = process.argv;
if (!city) {
  console.error('Usage: node infra/scripts/draft-destination.mjs "City name" [--lang en]');
  process.exit(1);
}
const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'en';
const api = `https://${lang}.wikivoyage.org/w/api.php`;
// A generic client name: no personal contact details go to outside services.
const headers = { 'user-agent': 'globetrot-curation-script/1.0' };

const KIND = { see: 'sight', do: 'sight', eat: 'food', drink: 'other', buy: 'shop', sleep: 'stay' };
const LIKES = {
  see: ['culture'],
  do: ['nature'],
  eat: ['food'],
  drink: ['nightlife'],
  buy: [],
  sleep: [],
};

/** `{{see | name=… | lat=… | long=… | price=… }}` → its fields. */
function parseListings(wikitext) {
  const listings = [];
  const pattern = /\{\{\s*(see|do|eat|drink|buy|sleep|listing)\s*\|([\s\S]*?)\}\}/gi;
  for (const match of wikitext.matchAll(pattern)) {
    const type = match[1].toLowerCase();
    const fields = {};
    for (const part of match[2].split('|')) {
      const eq = part.indexOf('=');
      if (eq > 0) fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    const lat = Number(fields.lat);
    const long = Number(fields.long);
    if (
      !fields.name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(long) ||
      (lat === 0 && long === 0)
    )
      continue;
    listings.push({
      type: type === 'listing' ? (fields.type ?? 'see') : type,
      ...fields,
      lat,
      long,
    });
  }
  return listings;
}

const slug = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  const url = `${api}?action=parse&format=json&prop=wikitext&redirects=1&page=${encodeURIComponent(city)}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Wikivoyage answered ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`No Wikivoyage page for "${city}"`);
  const wikitext = body.parse.wikitext['*'];
  const geo = /\{\{\s*geo\s*\|\s*([-\d.]+)\s*\|\s*([-\d.]+)/i.exec(wikitext);
  const listings = parseListings(wikitext);
  const key = slug(body.parse.title);
  const draft = {
    source: `https://${lang}.wikivoyage.org/wiki/${encodeURIComponent(body.parse.title)} (CC BY-SA)`,
    stop: {
      key,
      name: body.parse.title,
      namePt: 'TODO',
      latitude: geo ? Number(geo[1]) : null,
      longitude: geo ? Number(geo[2]) : null,
      nights: 'TODO',
      minNights: 'TODO',
      priority: 'TODO',
      daily: 'TODO: research budget and comfort ranges per person, with sources',
    },
    // [id, name, namePt, kind, likes, offbeat, cost, latitude, longitude]: review every field.
    experiences: listings
      .slice(0, 40)
      .map((listing) => [
        `${key}-${slug(listing.name)}`.slice(0, 60),
        listing.name,
        'TODO',
        KIND[listing.type] ?? 'other',
        LIKES[listing.type] ?? [],
        false,
        listing.price ? `TODO from "${listing.price}"` : 'TODO',
        Number(listing.lat.toFixed(4)),
        Number(listing.long.toFixed(4)),
      ]),
  };
  console.log(JSON.stringify(draft, null, 2));
  console.error(
    `${draft.experiences.length} listings with coordinates. Review, research prices and translate before use.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
