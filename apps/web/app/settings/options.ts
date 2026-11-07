import { listCountryCodes, listCurrencyCodes } from '@globetrot/domain';

export interface Option {
  readonly id: string;
  readonly label: string;
}

/** The id of the "Not set" entry of the optional fields. The server action turns it into `null`. */
export const NOT_SET = 'none';

const sorted = (options: Option[], locale: string) => {
  const collator = new Intl.Collator(locale);
  return options.sort((a, b) => collator.compare(a.label, b.label));
};

/** Country names in the user's language ("Brasil", "Japão"). The value sent is the ISO code. */
export function countryOptions(locale: string): Option[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return sorted(
    listCountryCodes().map((code) => ({ id: code, label: names.of(code) ?? code })),
    locale,
  );
}

/** "USD · US Dollar": the code stays visible so similar names are never ambiguous. */
export function currencyOptions(locale: string): Option[] {
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  return sorted(
    listCurrencyCodes().map((code) => ({ id: code, label: `${code} · ${names.of(code) ?? code}` })),
    locale,
  );
}

/** IANA zones the platform lists, plus the stored one when it is a valid name the list leaves out. */
export function timeZoneOptions(locale: string, stored: string | null): Option[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  zones.add('UTC');
  if (stored) zones.add(stored);
  return sorted(
    [...zones].map((zone) => ({ id: zone, label: zone.replaceAll('_', ' ') })),
    locale,
  );
}
