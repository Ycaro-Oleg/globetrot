# Spike #4: Managed geocoding evaluation

- Status: research in progress; no provider selected.
- Checked: 2026-11-07. Recheck prices and terms before implementation.
- Scope: address and POI search behind GeocodingPort. City search remains the local GeoNames index; public Nominatim is prohibited.

## Provisional recommendation

Geoapify is the leading candidate for an MVP adapter because its published FAQ permits storage with attribution, its free tier permits commercial use, and it describes EU hosting. This is a terms and operational recommendation, not a measured quality verdict. Compare candidates on the same en/pt-BR address and POI corpus, verify contracts and data processing, and obtain approval before recording a decision in ADR-0003. Keep a provider-neutral port and a manual pin/form path.

## Comparison

| Candidate | Search and rates | Storage and data handling |
|---|---|---|
| [Geoapify](https://www.geoapify.com/geocoding-api/) | Worldwide geocoding and autocomplete advertised; quality and Brazil coverage unmeasured. Free 3,000 credits/day, 5 requests/s; paid 12-30 requests/s. | FAQ: "we do not restrict you from storing results"; retain source attribution. Free commercial use also needs a Geoapify link. Its [privacy policy](https://www.geoapify.com/privacy-policy/) describes EU data centers and processors including Cloudflare, and logs request body, headers, IP and time, generally up to 24 hours for successful requests. EU hosting does not establish LGPD compliance or Brazil residency. |
| [LocationIQ](https://api.locationiq.com/pricing) | Autocomplete and geocoding; quality and coverage unmeasured. Free 5,000/day, 2/s and 60/min; Developer 25,000/day, 20/s. | [Terms](https://us1.locationiq.com/tos): "You can store response data forever." Request-response cache: free up to 48 hours; paid while a customer. Free commercial use requires a prominent provider link. US and EU data centers listed; routing, subprocessors and Brazilian transfer terms need confirmation. |
| [Stadia Maps](https://stadiamaps.com/pricing/) | Autocomplete v1/v2 and geocoding; quality and coverage unmeasured. Confirm rate limits. | [Documentation](https://docs.stadiamaps.com/geocoding-search-autocomplete/bulk-geocoding-search): "Temporary storage in the normal course of your work is allowed on all plans"; permanent storage requires active Standard, Professional or Enterprise. Confirm cancellation effects, attribution, processing regions and transfers. Free plan excludes commercial use. |
| [MapTiler](https://www.maptiler.com/cloud/pricing/) | Search and geocoding; quality and coverage unmeasured. Confirm rate limits and API pricing. | [Cloud terms](https://www.maptiler.com/terms/cloud/) allow "Results of the search services" outside the service; end-user device caching is temporary and personal. Separate proxy and server-side map-content restrictions make shared caching and server-side geocoding written-confirmation items. Confirm attribution, processing regions and transfers. Free plan is described for testing or non-commercial use. |
| [Photon self-hosted](https://github.com/komoot/photon) | Multilingual search-as-you-type; quality and rate limits depend on deployment. Prebuilt dumps list en, de, fr and local names; pt-BR needs validation. | OSM/ODbL and other data license obligations apply. We operate updates, availability and privacy. Upstream estimates about 95 GB disk and recommends at least 64 GB RAM for planet; atomic refresh needs about twice the disk. The public demo has no availability guarantee and is not a production fallback. |

## Language support: documented capabilities

- [Geoapify autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/) accepts two-letter language codes including en and pt. It does not document a pt-BR-specific locale parameter; verify Brazilian Portuguese display and fallback behavior in the corpus.
- [LocationIQ autocomplete](https://docs.locationiq.com/docs/autocomplete) lists supported languages and does not list pt. Native names may still be available; this does not establish Portuguese localization. Search and reverse are distinct endpoints, so their language support must not be assumed for autocomplete.
- A language parameter alone does not establish the quality, coverage or correctness of localized results.

## Illustrative monthly cost

USD, monthly billing, before tax and other APIs, assuming a uniform 30-day distribution, no bursts, one ordinary request per query and no other shared usage. Monthly volume does not guarantee compliance with daily or per-second limits. Autocomplete can send multiple requests per search. These are estimates, not quotes.

| Provider / assumption | 10k requests | 100k | 1M |
|---|---:|---:|---:|
| Geoapify: 1 credit/request, free 3k/day, API 10 10k/day, API 50 50k/day | $0 | $59 | $179 |
| LocationIQ: free 5k/day, Developer 25k/day, Startup 60k/day | $0 | $0 | $200 |
| Stadia: forward geocoding, 20 credits/request; Standard required for persistent storage; 7.5M included then $0.02/1k credits, assuming overage enabled | $80 | $80 | $330 |
| MapTiler Flex: request billing, 500k included then $0.15/1k | $30 | $30 | $105 |
| Photon | Infrastructure and operations not estimated | Same | Same |

Sources: [Geoapify pricing](https://www.geoapify.com/pricing/), [pricing details](https://www.geoapify.com/pricing-details/), [LocationIQ pricing](https://api.locationiq.com/pricing), [Stadia pricing and credit schedule](https://stadiamaps.com/pricing/), [MapTiler pricing](https://www.maptiler.com/cloud/pricing/). Stadia autocomplete v2 is listed at 1 credit/request and v1 at 20: this models forward geocoding only, not a mixed flow. Other services share quotas. MapTiler estimates assume direct or third-party request billing, not SDK search sessions; its Flex plan includes 500k API requests for $30/month and charges $0.15 per additional 1k. Search sessions are a separate billing model. See [pricing](https://www.maptiler.com/cloud/pricing/) and [billing models](https://docs.maptiler.com/guides/account/sessions-vs-requests/). Confirm overage, plan eligibility and endpoint access before purchase.

## Validation still required

1. Build a fixed, privacy-safe corpus with expected coordinates: Brazilian and Portuguese addresses and POIs, plus locations across Europe, Asia, Africa and the Americas; include accents, typos, partial input, ambiguous names, rural addresses and small islands. Exercise en and pt-BR with identical bias, limits and request stages. Do not use real user searches.
2. With accounts and keys, record top-1/top-5 correctness, localization, no-result rate, p50/p95 latency, rate limiting and actual credit consumption. Record sample size, date, endpoint and known gaps.
3. Confirm selected-place storage separately from shared query cache, attribution, rate limits, cancellation, proxy use, DPA, subprocessors and international transfers. Define retention and access before launch.
4. Present results and recommendation to the product owner; update ADR-0003 only after approval. The issue remains open until its exit criteria are met.
