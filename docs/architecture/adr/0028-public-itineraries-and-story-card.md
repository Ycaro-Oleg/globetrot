# 0028. Public itineraries and the progress card for stories

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
Globetrot had no way to be found: the landing is one page, shared trips are private links that search engines must not list, and nothing gave a person a reason to post their progress. Travel planning is searched ("roteiro Japão 12 dias", "quanto custa ir para Portugal"), and saving for a trip is something people like to show.

## Decision
- **Public itinerary pages** built from the curated catalog (ADR-0020): `/roteiros/{slugPt}` in Portuguese and `/itineraries/{slug}` in English, one per suggested destination. Each shows the reference plan (every stop at its usual nights, everything the person might like), the experiences with the ones few people know marked, how to get from one stop to the next, the typical cost per person on a budget and in comfort with the research date, what to set aside each month to go in 6 or 12 months, and "Make this trip mine", which opens the landing's planner with the destination picked (`/?plano={id}#planner`).
- **Language by address, currency by choice:** the address decides the language (the content carries `lang`); prices are in US dollars until the visitor picks another currency on the page (`?moeda=` / `?currency=`), converted at the recorded reference rate with its source stated. Never inferred.
- **Indexable:** each page has a canonical address, `hreflang` alternates, its own social image, and is listed in the sitemap in both languages. Shared trips stay unlisted.
- **Progress card:** `/t/{slug}/story` draws a 1080×1920 image from a trip's public link: the title, the route, how much is left (only when the owner shows amounts on the link, otherwise the percentage) and the month it is ready. The owner downloads it from the trip's page next to the link.
- Every amount stays labelled as a typical range, never a quote.

## Alternatives considered
- **A blog or hand-written guides:** slower to keep honest than pages generated from the same researched catalog the product uses.
- **Making shared trips indexable:** they are personal; the owner shares them with people, not with search engines.

## Consequences
- Each destination added to the catalog gets two indexable pages for free.
- The progress card needs the trip's public link to be on; turning the link off stops the image too.
