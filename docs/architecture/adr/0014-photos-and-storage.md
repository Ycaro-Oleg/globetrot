# 0014. Photos: S3-compatible storage, metadata cut out without decoding, served behind the API

- Status: Accepted
- Date: 2026-11-13

## Context
Posts (design handoff v2, "Community") and the pin card's "Photos" petal need photos. The business rules say EXIF location is removed from uploads, trips are private and another person's data answers "not found". Local development already runs S3-compatible storage (SeaweedFS); production storage is not chosen. AGENTS.md asks for no heavy dependency without the owner.

## Decision
- **Storage is a port** (`StoragePort`: `put`, `get`) with one adapter for any S3-compatible service, signed with SigV4 through **`aws4fetch`** (a few kilobytes, no dependencies) rather than the AWS SDK. Keys are `media/<id>`, chosen by the application. Production refuses to start without its own `S3_*` settings.
- **Metadata is removed without decoding pixels.** `cleanImage` in `@globetrot/domain` reads the real type from the bytes (JPEG, PNG or WebP only), checks the size (8 MB, 8192 px a side) and copies the file without EXIF, GPS, XMP, IPTC, comments and text chunks. No image library (such as `sharp`) is needed, and nothing is decompressed on the server.
- **The browser resizes first.** The web app draws the photo on a canvas (applying the camera's orientation), re-encodes it as a JPEG of at most 2048 px and uploads that; the server's stripping is the safety net for other clients.
- **Images are private and served by the API** (`GET /v1/media/{id}`, through the web origin's proxy) after an access check: the owner, or someone who may see a post showing it (`canSeePost`). Stop photos stay with the trip's owner. Answers are `Cache-Control: private` with `nosniff` and a `default-src 'none'` policy.
- **Photos are placed by reference** (`{ mediaId, alt }`) on a post (up to 4, moments and tips) or a stop (up to 12). Only images the caller uploaded can be placed. Every photo has a description field; a blank one falls back to "Photo by {name}" on posts.
- **Limits:** 100 uploads a day per person.

## Alternatives considered
- **`sharp` to re-encode on the server:** strongest stripping and thumbnails, but a native dependency of tens of megabytes; not needed while the browser resizes.
- **Signed public URLs from storage:** less load on the API, but the access check would be frozen into the URL until it expires, and storage would need public reachability.

## Consequences
- An upload that is never placed stays in storage: there is no cleanup job yet (no worker). Listed in `current-state.md`.
- No thumbnails: the browser receives the uploaded size (at most 2048 px from the web app).
- A JPEG uploaded straight to the API loses its orientation flag with the rest of EXIF; the web app applies orientation before upload.
