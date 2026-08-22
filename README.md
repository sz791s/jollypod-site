# JollyPod website and share links

The public website stays plain HTML and CSS with no framework, remote fonts, cookies, advertising, or analytics. A small Cloudflare Worker adds canonical JollyPod share links backed by D1.

## Pages

- `/` — Home
- `/features/` — Features
- `/support/` — Support and FAQ
- `/privacy/` — Privacy Policy
- `/terms/` — Terms and Conditions
- `/e/<short-id>` — episode link and web fallback
- `/p/<short-id>` — podcast link and web fallback
- `/api/shares` — share creation endpoint used by the native app

## Share-service boundaries

- D1 stores only the immutable identity and display metadata needed for a share link.
- Episode identity uses feed URL plus GUID, or feed URL plus enclosure URL when no GUID exists.
- The Worker never downloads a feed, webpage, or media URL supplied by a client.
- Opening a public link only reads metadata. It cannot play, subscribe, queue, archive, or change a library.
- New link creation is limited to 60 requests per client IP per minute by a Cloudflare rate-limit binding.
- `apple-app-site-association` permits only `/e/*` and `/p/*`.

## Run locally

Install dependencies and apply the local migration once:

```sh
pnpm install
pnpm run migrate:local
pnpm run dev
```

The static pages remain available through the Worker's assets binding. Opening individual HTML files directly from Finder is not a reliable preview because links are root-relative.

Run all generated-type, type, D1 integration, and deployment checks with:

```sh
pnpm run check
```

## First production deployment

1. Authenticate Wrangler with the Cloudflare account that owns `jollypod.app`.
2. Create the D1 database once: `pnpm exec wrangler d1 create jollypod-share`.
3. Apply the schema before routing traffic: `pnpm run migrate:remote`.
4. Run `pnpm run check`.
5. Deploy with `pnpm run deploy`.
6. Verify the AASA file and one episode and podcast link before releasing the app entitlement.

`wrangler.jsonc` intentionally omits a D1 `database_id`; current Wrangler resolves the named database. If the account requires an explicit ID, copy the ID returned in step 2 into the D1 binding.

The existing Pages project can remain as an emergency static fallback, but the `jollypod.app/*` Worker route serves production traffic after deployment. Do not bind a second Worker to the same route.

## Before a production launch

- Replace the TestFlight URL with the final App Store URL when available.
- Review the Privacy Policy and Terms whenever app data handling or subscription benefits change.
- Legal text is a practical starting point, not a substitute for advice from a qualified Swiss lawyer.
