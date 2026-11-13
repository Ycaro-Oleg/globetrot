/**
 * The continent of each ISO 3166-1 alpha-2 code, after the UN M49 continental groupings (the Americas split into
 * North, with Central America and the Caribbean, and South). Used to group a person's visas; never to decide
 * anything about entry rules.
 */
export const CONTINENTS = [
  'africa',
  'asia',
  'europe',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
] as const;
export type Continent = (typeof CONTINENTS)[number];

const MEMBERS: Record<Continent, string> = {
  africa:
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW IO TF',
  asia: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
  europe:
    'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB',
  'north-america':
    'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  'south-america': 'AR BO BV BR CL CO EC FK GF GY PY PE GS SR UY VE',
  oceania: 'AS AU CX CC CK FJ PF GU HM KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
  antarctica: 'AQ',
};

const BY_CODE = new Map<string, Continent>(
  CONTINENTS.flatMap((continent) =>
    MEMBERS[continent].split(' ').map((code) => [code, continent] as const),
  ),
);

/** The continent of a country code, or null for a code that is not in the list. */
export function continentOf(code: string): Continent | null {
  return BY_CODE.get(code.toUpperCase()) ?? null;
}
