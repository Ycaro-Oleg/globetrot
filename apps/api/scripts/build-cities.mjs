// Builds apps/api/src/data/cities.json from GeoNames dumps (CC BY 4.0, https://www.geonames.org/):
//   node apps/api/scripts/build-cities.mjs <dir with cities15000.txt and admin1CodesASCII.txt>
// Every city of 15 000 people or more (not city sections): id, name, ASCII name, country, region, point, population, and for big cities
// a few Latin-script alternative names (so "Londres" finds London).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Pass the folder with the GeoNames files');
const admin = new Map(
  readFileSync(join(dir, 'admin1CodesASCII.txt'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .map(([code, name]) => [code, name]),
);
const regions = [];
const regionIndex = new Map();
const region = (name) => {
  if (!name) return -1;
  if (!regionIndex.has(name)) {
    regionIndex.set(name, regions.length);
    regions.push(name);
  }
  return regionIndex.get(name);
};
const latin = /^[\p{Script=Latin}\s'’.-]+$/u;
const cities = readFileSync(join(dir, 'cities15000.txt'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  // Sections of a city (Paris 15e, a borough) are not places people fly to: leave them out.
  // and French arrondissements ("Paris 15 Vaugirard", "Lyon 03") are listed as towns of their own.
  .filter((f) => f[7] !== 'PPLX' && !(f[8] === 'FR' && / \d{1,2}( |$)/.test(f[1])))
  .map((f) => {
    const [id, name, ascii, alternates, lat, lon, , , cc, , admin1] = f;
    const population = Number(f[14]) || 0;
    const fold = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const seen = new Set([fold(name), fold(ascii)]);
    const alts =
      population >= 200000
        ? alternates
            .split(',')
            .filter((a) => a.length >= 3 && a.length <= 40 && latin.test(a))
            .filter((a) => {
              const key = fold(a);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(0, population >= 1000000 ? 60 : 20)
        : [];
    const row = [
      Number(id),
      name,
      ascii === name ? 0 : ascii,
      cc,
      region(admin.get(`${cc}.${admin1}`)),
      Math.round(Number(lat) * 1000) / 1000,
      Math.round(Number(lon) * 1000) / 1000,
      population,
    ];
    if (alts.length) row.push(alts);
    return row;
  })
  .sort((a, b) => b[7] - a[7]);
writeFileSync(
  new URL('../src/data/cities.json', import.meta.url),
  JSON.stringify({ source: 'GeoNames cities15000 (CC BY 4.0)', regions, cities }),
);
console.log(`${cities.length} cities, ${regions.length} regions`);
