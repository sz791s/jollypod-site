import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

interface CreateResponse {
  version: number;
  id: string;
  kind: "episode" | "podcast";
  url: string;
}

interface SharedRecord {
  version: number;
  id: string;
  kind: "episode" | "podcast";
  feedURL: string;
  guid: string | null;
  enclosureURL: string | null;
  podcastTitle: string;
  episodeTitle: string | null;
}

const baseEpisode = {
  version: 1,
  kind: "episode",
  feedURL: "https://feeds.example.com/show.xml",
  guid: "episode-guid",
  enclosureURL: "https://cdn.example.com/episode.mp3",
  podcastTitle: "Example Podcast",
  podcastAuthor: "Example Author",
  podcastWebpageURL: "https://www.example.com/podcast",
  episodeTitle: "Example Episode",
  episodeWebpageURL: "https://www.example.com/podcast/episode",
  publishedAt: 1_700_000_000,
  durationSeconds: 1800,
} as const;

const basePodcast = {
  version: 1,
  kind: "podcast",
  feedURL: "https://feeds.example.com/show.xml",
  podcastTitle: "Example Podcast",
  podcastAuthor: "Example Author",
  podcastWebpageURL: "https://www.example.com/podcast",
} as const;

describe("share creation", () => {
  it("returns the same episode ID for the same feed and GUID", async () => {
    const first = await createShare(baseEpisode, "198.51.100.10");
    const firstBody = await json<CreateResponse>(first);
    const second = await createShare(
      {
        ...baseEpisode,
        enclosureURL: "https://cdn.example.com/replaced.mp3",
        episodeTitle: "Updated title",
      },
      "198.51.100.10",
    );
    const secondBody = await json<CreateResponse>(second);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(firstBody.id).toMatch(/^[A-Za-z0-9_-]{12}$/u);
    expect(secondBody.id).toBe(firstBody.id);
    expect(firstBody.url).toBe(`https://jollypod.app/e/${firstBody.id}`);

    const stored = await resolveJSON(firstBody.url);
    expect(stored.episodeTitle).toBe("Example Episode");
    expect(stored.enclosureURL).toBe(baseEpisode.enclosureURL);
  });

  it("uses enclosure identity only when a GUID is unavailable", async () => {
    const first = await createShare(
      { ...baseEpisode, guid: null, enclosureURL: "https://cdn.example.com/fallback.mp3" },
      "198.51.100.11",
    );
    const second = await createShare(
      { ...baseEpisode, guid: null, enclosureURL: "https://cdn.example.com/other.mp3" },
      "198.51.100.11",
    );

    expect((await json<CreateResponse>(first)).id)
      .not.toBe((await json<CreateResponse>(second)).id);
  });

  it("returns a stable podcast ID based on its feed", async () => {
    const first = await createShare(basePodcast, "198.51.100.12");
    const second = await createShare(
      { ...basePodcast, podcastTitle: "A newer title" },
      "198.51.100.12",
    );
    const firstBody = await json<CreateResponse>(first);
    const secondBody = await json<CreateResponse>(second);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(secondBody.id).toBe(firstBody.id);
    expect(firstBody.url).toBe(`https://jollypod.app/p/${firstBody.id}`);
  });

  it("rejects private, malformed, oversized, and mixed-kind metadata", async () => {
    const privateFeed = await createShare(
      { ...baseEpisode, feedURL: "http://127.0.0.1/feed" },
      "198.51.100.13",
    );
    const shorthandPrivateFeed = await createShare(
      { ...baseEpisode, feedURL: "http://127.1/feed" },
      "198.51.100.13",
    );
    const hexadecimalPrivateFeed = await createShare(
      { ...baseEpisode, feedURL: "http://0x7f.0.0.1/feed" },
      "198.51.100.13",
    );
    const reservedFeed = await createShare(
      { ...baseEpisode, feedURL: "https://podcast.invalid/feed" },
      "198.51.100.13",
    );
    const podcastWithEpisode = await createShare(
      { ...basePodcast, episodeTitle: "Must not be present" },
      "198.51.100.13",
    );
    const unknownField = await createShare(
      { ...baseEpisode, autoplay: true },
      "198.51.100.13",
    );
    const controlCharacter = await createShare(
      { ...baseEpisode, episodeTitle: "bad\u0000title" },
      "198.51.100.13",
    );
    const oversized = await workerFetch("/api/shares", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "198.51.100.13",
      },
      body: JSON.stringify({ ...baseEpisode, episodeTitle: "x".repeat(17_000) }),
    });

    expect(privateFeed.status).toBe(400);
    expect(shorthandPrivateFeed.status).toBe(400);
    expect(hexadecimalPrivateFeed.status).toBe(400);
    expect(reservedFeed.status).toBe(400);
    expect(podcastWithEpisode.status).toBe(400);
    expect(unknownField.status).toBe(400);
    expect(controlCharacter.status).toBe(400);
    expect(oversized.status).toBe(413);
  });
});

describe("share resolution", () => {
  it("returns validated JSON and accepts only canonical position parameters", async () => {
    const created = await json<CreateResponse>(
      await createShare(baseEpisode, "198.51.100.20"),
    );

    const valid = await workerFetch(`/e/${created.id}?t=754`, {
      headers: { Accept: "application/json" },
    });
    const leadingZero = await workerFetch(`/e/${created.id}?t=0754`, {
      headers: { Accept: "application/json" },
    });
    const action = await workerFetch(`/e/${created.id}?play=1`, {
      headers: { Accept: "application/json" },
    });
    const tooLarge = await workerFetch(`/e/${created.id}?t=2592001`, {
      headers: { Accept: "application/json" },
    });

    expect(valid.status).toBe(200);
    expect((await json<SharedRecord>(valid)).id).toBe(created.id);
    expect(leadingZero.status).toBe(404);
    expect(action.status).toBe(404);
    expect(tooLarge.status).toBe(404);
  });

  it("renders an escaped, metadata-only web fallback", async () => {
    const created = await json<CreateResponse>(
      await createShare(
        {
          ...baseEpisode,
          guid: "escape-test-guid",
          episodeTitle: "<script>alert('no')</script>",
        },
        "198.51.100.21",
      ),
    );

    const response = await workerFetch(`/e/${created.id}?t=75`, {
      headers: { Accept: "text/html" },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain("&lt;script&gt;alert(&#39;no&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert('no')</script>");
    expect(html).not.toContain(baseEpisode.enclosureURL);
    expect(html).toContain("Shared from 1:15");
    expect(html).toContain("never starts playback");
    expect(html).toContain(`<link rel="canonical" href="${created.url}?t=75">`);
  });

  it("does not change D1 records while resolving or handling missing links", async () => {
    const created = await json<CreateResponse>(
      await createShare(basePodcast, "198.51.100.22"),
    );
    const before = await shareCount();

    const resolved = await workerFetch(`/p/${created.id}`, {
      headers: { Accept: "application/json" },
    });
    const withPosition = await workerFetch(`/p/${created.id}?t=1`, {
      headers: { Accept: "application/json" },
    });
    const missing = await workerFetch("/p/NotFound_12", {
      headers: { Accept: "application/json" },
    });

    expect(resolved.status).toBe(200);
    expect(withPosition.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await shareCount()).toBe(before);
  });

  it("supports HEAD without returning a body", async () => {
    const created = await json<CreateResponse>(
      await createShare(basePodcast, "198.51.100.23"),
    );
    const response = await workerFetch(`/p/${created.id}`, {
      method: "HEAD",
      headers: { Accept: "application/json" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});

describe("associated domains", () => {
  it("publishes an AASA file limited to episode and podcast paths", async () => {
    const response = await workerFetch("/.well-known/apple-app-site-association");
    const body = await response.json() as {
      applinks: { details: Array<{ appIDs: string[]; components: Array<{ "/": string }> }> };
    };
    const detail = body.applinks.details[0];

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(detail?.appIDs).toEqual(["N886FR56SY.com.simonzryd.jollypod-app"]);
    expect(detail?.components.map((component) => component["/"]))
      .toEqual(["/e/*", "/p/*"]);
  });
});

async function createShare(payload: object, ip: string): Promise<Response> {
  return workerFetch("/api/shares", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify(payload),
  });
}

async function resolveJSON(url: string): Promise<SharedRecord> {
  const parsed = new URL(url);
  return json<SharedRecord>(
    await workerFetch(parsed.pathname, { headers: { Accept: "application/json" } }),
  );
}

async function shareCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM share_links")
    .first<{ count: number }>();
  return row?.count ?? 0;
}

function workerFetch(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`https://jollypod.app${path}`, init));
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
