const CANONICAL_ORIGIN = "https://jollypod.app";
const MAXIMUM_REQUEST_BYTES = 16 * 1024;
const MAXIMUM_START_TIME_SECONDS = 30 * 24 * 60 * 60;
const SHARE_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const MAXIMUM_PUBLIC_CACHE_SECONDS = 5 * 60;
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/u;
const PUBLIC_ROUTE_PATTERN = /^\/(e|p)\/([A-Za-z0-9_-]{8,32})$/u;
const TESTFLIGHT_URL = "https://testflight.apple.com/join/Uh3skMhD";

type ShareKind = "episode" | "podcast";
type LocaleCode = "en" | "de" | "es" | "fr" | "it" | "ja" | "pt-BR" | "zh-Hans";

interface ShareInput {
  version: 1;
  kind: ShareKind;
  feedURL: string;
  guid: string | null;
  enclosureURL: string | null;
  podcastTitle: string;
  podcastAuthor: string | null;
  podcastWebpageURL: string | null;
  episodeTitle: string | null;
  episodeWebpageURL: string | null;
  publishedAt: number | null;
  durationSeconds: number | null;
}

interface ShareRow {
  id: string;
  kind: ShareKind;
  feed_url: string;
  guid: string | null;
  enclosure_url: string | null;
  podcast_title: string;
  podcast_author: string | null;
  podcast_webpage_url: string | null;
  episode_title: string | null;
  episode_webpage_url: string | null;
  published_at: number | null;
  duration_seconds: number | null;
  expires_at: number;
}

interface ShareRecord {
  version: 1;
  id: string;
  kind: ShareKind;
  feedURL: string;
  guid: string | null;
  enclosureURL: string | null;
  podcastTitle: string;
  podcastAuthor: string | null;
  podcastWebpageURL: string | null;
  episodeTitle: string | null;
  episodeWebpageURL: string | null;
  publishedAt: number | null;
  durationSeconds: number | null;
}

interface PublicRoute {
  kind: ShareKind;
  shortID: string;
  startTimeSeconds: number | null;
}

interface SharePageCopy {
  htmlLang: string;
  sharedEpisode: string;
  sharedPodcast: string;
  openInJollyPod: string;
  getJollyPod: string;
  originalWebsite: string;
  safety: string;
  publishedPrefix: string;
  sharedFromPrefix: string;
  linkUnavailableTitle: string;
  linkUnavailableEyebrow: string;
  nothingToOpen: string;
  notFoundMessage: string;
  visitJollyPod: string;
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const SELECT_COLUMNS = `
  id,
  kind,
  feed_url,
  guid,
  enclosure_url,
  podcast_title,
  podcast_author,
  podcast_webpage_url,
  episode_title,
  episode_webpage_url,
  published_at,
  duration_seconds,
  expires_at
`;

const INSERT_SHARE = `
  INSERT OR IGNORE INTO share_links (
    id,
    identity_key,
    kind,
    feed_url,
    guid,
    enclosure_url,
    podcast_title,
    podcast_author,
    podcast_webpage_url,
    episode_title,
    episode_webpage_url,
    published_at,
    duration_seconds,
    expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const DEFAULT_LOCALE: LocaleCode = "en";
const SUPPORTED_LOCALES: LocaleCode[] = ["en", "de", "es", "fr", "it", "ja", "pt-BR", "zh-Hans"];
const COPY: Record<LocaleCode, SharePageCopy> = {
  en: {
    htmlLang: "en",
    sharedEpisode: "Shared episode",
    sharedPodcast: "Shared podcast",
    openInJollyPod: "Open in JollyPod",
    getJollyPod: "Get JollyPod",
    originalWebsite: "Original website",
    safety: "Opening this link only shows the item. It never starts playback, subscribes, or changes your queue or library.",
    publishedPrefix: "Published",
    sharedFromPrefix: "Shared from",
    linkUnavailableTitle: "Link unavailable",
    linkUnavailableEyebrow: "Link unavailable",
    nothingToOpen: "Nothing to open here.",
    notFoundMessage: "This shared episode or podcast could not be found.",
    visitJollyPod: "Visit JollyPod",
  },
  de: {
    htmlLang: "de",
    sharedEpisode: "Geteilte Episode",
    sharedPodcast: "Geteilter Podcast",
    openInJollyPod: "In JollyPod öffnen",
    getJollyPod: "JollyPod laden",
    originalWebsite: "Original-Website",
    safety: "Dieser Link zeigt den Inhalt nur an. Er startet nie die Wiedergabe, abonniert nichts und ändert weder Queue noch Mediathek.",
    publishedPrefix: "Veröffentlicht",
    sharedFromPrefix: "Geteilt ab",
    linkUnavailableTitle: "Link nicht verfügbar",
    linkUnavailableEyebrow: "Link nicht verfügbar",
    nothingToOpen: "Hier gibt es nichts zu öffnen.",
    notFoundMessage: "Diese geteilte Episode oder dieser Podcast konnte nicht gefunden werden.",
    visitJollyPod: "JollyPod besuchen",
  },
  es: {
    htmlLang: "es",
    sharedEpisode: "Episodio compartido",
    sharedPodcast: "Podcast compartido",
    openInJollyPod: "Abrir en JollyPod",
    getJollyPod: "Obtener JollyPod",
    originalWebsite: "Sitio web original",
    safety: "Abrir este enlace solo muestra el elemento. Nunca inicia la reproducción, no suscribe ni cambia tu cola o biblioteca.",
    publishedPrefix: "Publicado",
    sharedFromPrefix: "Compartido desde",
    linkUnavailableTitle: "Enlace no disponible",
    linkUnavailableEyebrow: "Enlace no disponible",
    nothingToOpen: "No hay nada que abrir aquí.",
    notFoundMessage: "No se pudo encontrar este episodio o podcast compartido.",
    visitJollyPod: "Visitar JollyPod",
  },
  fr: {
    htmlLang: "fr",
    sharedEpisode: "Épisode partagé",
    sharedPodcast: "Podcast partagé",
    openInJollyPod: "Ouvrir dans JollyPod",
    getJollyPod: "Obtenir JollyPod",
    originalWebsite: "Site web d’origine",
    safety: "Ouvrir ce lien affiche seulement l’élément. Il ne lance jamais la lecture, n’abonne pas et ne modifie pas votre file ou bibliothèque.",
    publishedPrefix: "Publié le",
    sharedFromPrefix: "Partagé depuis",
    linkUnavailableTitle: "Lien indisponible",
    linkUnavailableEyebrow: "Lien indisponible",
    nothingToOpen: "Rien à ouvrir ici.",
    notFoundMessage: "Cet épisode ou podcast partagé est introuvable.",
    visitJollyPod: "Visiter JollyPod",
  },
  it: {
    htmlLang: "it",
    sharedEpisode: "Episodio condiviso",
    sharedPodcast: "Podcast condiviso",
    openInJollyPod: "Apri in JollyPod",
    getJollyPod: "Scarica JollyPod",
    originalWebsite: "Sito web originale",
    safety: "L’apertura di questo link mostra solo l’elemento. Non avvia mai la riproduzione, non iscrive e non modifica la coda o la libreria.",
    publishedPrefix: "Pubblicato",
    sharedFromPrefix: "Condiviso da",
    linkUnavailableTitle: "Link non disponibile",
    linkUnavailableEyebrow: "Link non disponibile",
    nothingToOpen: "Qui non c’è nulla da aprire.",
    notFoundMessage: "Questo episodio o podcast condiviso non è stato trovato.",
    visitJollyPod: "Visita JollyPod",
  },
  ja: {
    htmlLang: "ja",
    sharedEpisode: "共有されたエピソード",
    sharedPodcast: "共有されたポッドキャスト",
    openInJollyPod: "JollyPodで開く",
    getJollyPod: "JollyPodを入手",
    originalWebsite: "元のウェブサイト",
    safety: "このリンクを開いても項目を表示するだけです。再生、購読、キューやライブラリの変更は行いません。",
    publishedPrefix: "公開日",
    sharedFromPrefix: "共有位置",
    linkUnavailableTitle: "リンクを利用できません",
    linkUnavailableEyebrow: "リンクを利用できません",
    nothingToOpen: "ここで開けるものはありません。",
    notFoundMessage: "共有されたエピソードまたはポッドキャストが見つかりませんでした。",
    visitJollyPod: "JollyPodを見る",
  },
  "pt-BR": {
    htmlLang: "pt-BR",
    sharedEpisode: "Episódio compartilhado",
    sharedPodcast: "Podcast compartilhado",
    openInJollyPod: "Abrir no JollyPod",
    getJollyPod: "Obter JollyPod",
    originalWebsite: "Site original",
    safety: "Abrir este link apenas mostra o item. Ele nunca inicia a reprodução, assina ou altera sua fila ou biblioteca.",
    publishedPrefix: "Publicado em",
    sharedFromPrefix: "Compartilhado a partir de",
    linkUnavailableTitle: "Link indisponível",
    linkUnavailableEyebrow: "Link indisponível",
    nothingToOpen: "Não há nada para abrir aqui.",
    notFoundMessage: "Este episódio ou podcast compartilhado não foi encontrado.",
    visitJollyPod: "Visitar JollyPod",
  },
  "zh-Hans": {
    htmlLang: "zh-Hans",
    sharedEpisode: "分享的单集",
    sharedPodcast: "分享的播客",
    openInJollyPod: "在 JollyPod 中打开",
    getJollyPod: "获取 JollyPod",
    originalWebsite: "原始网站",
    safety: "打开此链接只会显示该项目。它绝不会自动播放、订阅，也不会更改你的队列或资料库。",
    publishedPrefix: "发布于",
    sharedFromPrefix: "分享自",
    linkUnavailableTitle: "链接不可用",
    linkUnavailableEyebrow: "链接不可用",
    nothingToOpen: "这里没有可打开的内容。",
    notFoundMessage: "找不到这个分享的单集或播客。",
    visitJollyPod: "访问 JollyPod",
  },
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/shares") {
        return await handleCreate(request, url, env);
      }

      if (url.pathname.startsWith("/e/") || url.pathname.startsWith("/p/")) {
        return await handleResolve(request, url, env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof RequestError) {
        return errorResponse(request, error.status, error.code, error.message);
      }

      console.error({
        event: "share_worker_request_failed",
        path: url.pathname,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return errorResponse(
        request,
        503,
        "service_unavailable",
        "This JollyPod link is temporarily unavailable.",
      );
    }
  },

  async scheduled(controller, env, _ctx): Promise<void> {
    const nowSeconds = Math.floor(controller.scheduledTime / 1000);
    const result = await deleteExpiredShares(env.DB, nowSeconds);
    console.log({
      event: "share_retention_cleanup",
      deletedRecords: result.meta.changes,
      scheduledTime: controller.scheduledTime,
    });
  },
} satisfies ExportedHandler<Env>;

async function handleCreate(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(request, "POST");
  }
  if (url.search !== "") {
    throw new RequestError(400, "invalid_request", "The request URL is invalid.");
  }

  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestError(415, "unsupported_media_type", "A JSON request is required.");
  }

  const rateLimitKey = request.headers.get("cf-connecting-ip") ?? "unknown-client";
  const rateLimit = await env.SHARE_CREATE_RATE_LIMITER.limit({ key: rateLimitKey });
  if (!rateLimit.success) {
    return dynamicResponse(request, JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": "60",
      },
    });
  }

  const input = validateShareInput(await readBoundedJSON(request));
  const identityKey = await makeIdentityKey(input);
  const nowSeconds = currentUnixTimeSeconds();
  const expiresAt = nowSeconds + SHARE_RETENTION_SECONDS;
  const existing = await findByIdentity(env.DB, identityKey, nowSeconds);
  if (existing !== null) {
    await env.DB.prepare("UPDATE share_links SET expires_at = MAX(expires_at, ?) WHERE id = ?")
      .bind(expiresAt, existing.id)
      .run();
    existing.expires_at = Math.max(existing.expires_at, expiresAt);
    return createResponse(request, existing, 200);
  }

  await env.DB.prepare(
    "DELETE FROM share_links WHERE identity_key = ? AND expires_at <= ?",
  )
    .bind(identityKey, nowSeconds)
    .run();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shortID = generateShortID();
    await env.DB.prepare(INSERT_SHARE)
      .bind(
        shortID,
        identityKey,
        input.kind,
        input.feedURL,
        input.guid,
        input.enclosureURL,
        input.podcastTitle,
        input.podcastAuthor,
        input.podcastWebpageURL,
        input.episodeTitle,
        input.episodeWebpageURL,
        input.publishedAt,
        input.durationSeconds,
        expiresAt,
      )
      .run();

    const inserted = await findByIdentity(env.DB, identityKey, nowSeconds);
    if (inserted !== null) {
      if (inserted.expires_at < expiresAt) {
        await env.DB.prepare("UPDATE share_links SET expires_at = MAX(expires_at, ?) WHERE id = ?")
          .bind(expiresAt, inserted.id)
          .run();
        inserted.expires_at = expiresAt;
      }
      return createResponse(request, inserted, inserted.id === shortID ? 201 : 200);
    }
  }

  throw new Error("Unable to allocate a unique share ID");
}

async function handleResolve(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed(request, "GET, HEAD");
  }

  const route = parsePublicRoute(url);
  if (route === null) {
    return notFoundResponse(request);
  }

  const nowSeconds = currentUnixTimeSeconds();
  const row = await env.DB.prepare(
    `SELECT ${SELECT_COLUMNS} FROM share_links WHERE id = ? AND kind = ? AND expires_at > ? LIMIT 1`,
  )
    .bind(route.shortID, route.kind, nowSeconds)
    .first<ShareRow>();
  if (row === null) {
    return notFoundResponse(request);
  }

  const record = rowToRecord(row);
  const cacheSeconds = publicCacheSeconds(row.expires_at, nowSeconds);
  if (wantsJSON(request)) {
    return dynamicResponse(request, JSON.stringify(record), {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, must-revalidate`,
        "Content-Type": "application/json; charset=utf-8",
        Vary: "Accept",
      },
    });
  }

  return dynamicResponse(request, renderSharePage(record, route, request.headers.get("accept-language")), {
    status: 200,
    headers: {
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, must-revalidate`,
      "Content-Type": "text/html; charset=utf-8",
      Vary: "Accept, Accept-Language",
    },
  });
}

async function findByIdentity(
  db: D1Database,
  identityKey: string,
  nowSeconds: number,
): Promise<ShareRow | null> {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM share_links WHERE identity_key = ? AND expires_at > ? LIMIT 1`)
    .bind(identityKey, nowSeconds)
    .first<ShareRow>();
}

function deleteExpiredShares(db: D1Database, nowSeconds: number): Promise<D1Result> {
  return db.prepare("DELETE FROM share_links WHERE expires_at <= ?")
    .bind(nowSeconds)
    .run();
}

function currentUnixTimeSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function publicCacheSeconds(expiresAt: number, nowSeconds: number): number {
  return Math.max(0, Math.min(MAXIMUM_PUBLIC_CACHE_SECONDS, expiresAt - nowSeconds));
}

function createResponse(request: Request, row: ShareRow, status: 200 | 201): Response {
  const path = row.kind === "episode" ? "e" : "p";
  const url = `${CANONICAL_ORIGIN}/${path}/${row.id}`;
  return dynamicResponse(
    request,
    JSON.stringify({ version: 1, id: row.id, kind: row.kind, url, expiresAt: row.expires_at }),
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        Location: url,
      },
    },
  );
}

function parsePublicRoute(url: URL): PublicRoute | null {
  const match = PUBLIC_ROUTE_PATTERN.exec(url.pathname);
  if (match === null) {
    return null;
  }

  const pathKind = match[1];
  const shortID = match[2];
  if (shortID === undefined || !SHORT_ID_PATTERN.test(shortID)) {
    return null;
  }

  if (pathKind === "p") {
    return url.search === ""
      ? { kind: "podcast", shortID, startTimeSeconds: null }
      : null;
  }
  if (pathKind !== "e") {
    return null;
  }

  if (url.search === "") {
    return { kind: "episode", shortID, startTimeSeconds: null };
  }
  const timeMatch = /^\?t=(0|[1-9][0-9]*)$/u.exec(url.search);
  const rawSeconds = timeMatch?.[1];
  if (rawSeconds === undefined) {
    return null;
  }
  const seconds = Number(rawSeconds);
  if (!Number.isSafeInteger(seconds) || seconds > MAXIMUM_START_TIME_SECONDS) {
    return null;
  }
  return { kind: "episode", shortID, startTimeSeconds: seconds };
}

async function readBoundedJSON(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new RequestError(400, "invalid_request", "The request length is invalid.");
    }
    if (parsedLength > MAXIMUM_REQUEST_BYTES) {
      throw new RequestError(413, "payload_too_large", "The request is too large.");
    }
  }

  if (request.body === null) {
    throw new RequestError(400, "invalid_json", "A JSON body is required.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteCount += value.byteLength;
      if (byteCount > MAXIMUM_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestError(413, "payload_too_large", "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return JSON.parse(source) as unknown;
  } catch {
    throw new RequestError(400, "invalid_json", "The JSON body is invalid.");
  }
}

const INPUT_KEYS = new Set([
  "version",
  "kind",
  "feedURL",
  "guid",
  "enclosureURL",
  "podcastTitle",
  "podcastAuthor",
  "podcastWebpageURL",
  "episodeTitle",
  "episodeWebpageURL",
  "publishedAt",
  "durationSeconds",
]);

function validateShareInput(value: unknown): ShareInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidInput();
  }
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (!INPUT_KEYS.has(key)) {
      throw invalidInput();
    }
  }

  if (object.version !== 1 || (object.kind !== "episode" && object.kind !== "podcast")) {
    throw invalidInput();
  }

  const kind = object.kind;
  const feedURL = requiredPublicURL(object.feedURL);
  const guid = optionalIdentity(object.guid, 1024);
  const enclosureURL = optionalPublicURL(object.enclosureURL);
  const podcastTitle = requiredDisplayText(object.podcastTitle, 300);
  const podcastAuthor = optionalDisplayText(object.podcastAuthor, 200);
  const podcastWebpageURL = optionalPublicURL(object.podcastWebpageURL);
  const episodeTitle = optionalDisplayText(object.episodeTitle, 300);
  const episodeWebpageURL = optionalPublicURL(object.episodeWebpageURL);
  const publishedAt = optionalInteger(object.publishedAt, 0, 253_402_300_799);
  const durationSeconds = optionalInteger(
    object.durationSeconds,
    1,
    MAXIMUM_START_TIME_SECONDS,
  );

  if (kind === "episode") {
    if (episodeTitle === null || (guid === null && enclosureURL === null)) {
      throw invalidInput();
    }
  } else if (
    guid !== null
    || enclosureURL !== null
    || episodeTitle !== null
    || episodeWebpageURL !== null
    || publishedAt !== null
    || durationSeconds !== null
  ) {
    throw invalidInput();
  }

  return {
    version: 1,
    kind,
    feedURL,
    guid,
    enclosureURL,
    podcastTitle,
    podcastAuthor,
    podcastWebpageURL,
    episodeTitle,
    episodeWebpageURL,
    publishedAt,
    durationSeconds,
  };
}

function invalidInput(): RequestError {
  return new RequestError(400, "invalid_request", "The share metadata is invalid.");
}

function requiredDisplayText(value: unknown, maximumLength: number): string {
  const result = optionalDisplayText(value, maximumLength);
  if (result === null) {
    throw invalidInput();
  }
  return result;
}

function optionalDisplayText(value: unknown, maximumLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw invalidInput();
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (
    normalized.length === 0
    || [...normalized].length > maximumLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw invalidInput();
  }
  return normalized;
}

function optionalIdentity(value: unknown, maximumLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw invalidInput();
  }
  const normalized = value.trim();
  if (
    normalized.length === 0
    || [...normalized].length > maximumLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw invalidInput();
  }
  return normalized;
}

function optionalInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw invalidInput();
  }
  return value as number;
}

function requiredPublicURL(value: unknown): string {
  const result = normalizePublicURL(value);
  if (result === null) {
    throw invalidInput();
  }
  return result;
}

function optionalPublicURL(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const result = normalizePublicURL(value);
  if (result === null) {
    throw invalidInput();
  }
  return result;
}

function normalizePublicURL(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const candidate = value.trim();
  if (candidate.length === 0 || new TextEncoder().encode(candidate).byteLength > 2048) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:")
    || url.username !== ""
    || url.password !== ""
    || url.hash !== ""
    || !isPublicHostname(url.hostname)
  ) {
    return null;
  }
  return url.href;
}

function isPublicHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase();
  if (
    hostname.length === 0
    || hostname.length > 253
    || hostname.endsWith(".")
    || hostname.includes(":")
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".lan")
    || hostname.endsWith(".example")
    || hostname.endsWith(".invalid")
    || hostname.endsWith(".test")
    || hostname.endsWith(".onion")
  ) {
    return false;
  }

  const ipv4 = parseIPv4(hostname);
  if (ipv4 !== null) {
    return isPublicIPv4(ipv4);
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every(
    (label) => label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
  );
}

function parseIPv4(hostname: string): [number, number, number, number] | null {
  if (!/^[0-9]+(?:\.[0-9]+){3}$/u.test(hostname)) {
    return null;
  }
  const values = hostname.split(".").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value > 255)) {
    return null;
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0];
}

function isPublicIPv4([first, second, third]: [number, number, number, number]): boolean {
  return first !== 0
    && first !== 10
    && first !== 127
    && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 0)
    && !(first === 192 && second === 168)
    && !(first === 198 && (second === 18 || second === 19))
    && !(first === 198 && second === 51 && third === 100)
    && !(first === 203 && second === 0 && third === 113);
}

async function makeIdentityKey(input: ShareInput): Promise<string> {
  const identity = input.kind === "podcast"
    ? ["podcast", input.feedURL]
    : input.guid !== null
      ? ["episode", input.feedURL, "guid", input.guid]
      : ["episode", input.feedURL, "enclosure", input.enclosureURL ?? ""];
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity.join("\u0000")),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateShortID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function rowToRecord(row: ShareRow): ShareRecord {
  return {
    version: 1,
    id: row.id,
    kind: row.kind,
    feedURL: row.feed_url,
    guid: row.guid,
    enclosureURL: row.enclosure_url,
    podcastTitle: row.podcast_title,
    podcastAuthor: row.podcast_author,
    podcastWebpageURL: row.podcast_webpage_url,
    episodeTitle: row.episode_title,
    episodeWebpageURL: row.episode_webpage_url,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds,
  };
}

function wantsJSON(request: Request): boolean {
  return request.headers.get("accept")?.toLowerCase().includes("application/json") === true;
}

function methodNotAllowed(request: Request, allow: string): Response {
  return dynamicResponse(request, JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: {
      Allow: allow,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function notFoundResponse(request: Request): Response {
  if (wantsJSON(request)) {
    return errorResponse(request, 404, "not_found", "This shared JollyPod link was not found.");
  }
  return dynamicResponse(request, renderNotFoundPage(request.headers.get("accept-language")), {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60",
      "Content-Type": "text/html; charset=utf-8",
      Vary: "Accept, Accept-Language",
    },
  });
}

function errorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
): Response {
  if (!wantsJSON(request) && request.method !== "POST") {
    return dynamicResponse(request, renderErrorPage(message, request.headers.get("accept-language")), {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        Vary: "Accept, Accept-Language",
      },
    });
  }
  return dynamicResponse(request, JSON.stringify({ error: code }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function dynamicResponse(request: Request, body: BodyInit | null, init: ResponseInit): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(request.method === "HEAD" ? null : body, { ...init, headers });
}

function resolveLocale(localeHeader?: string | null): LocaleCode {
  if (localeHeader === null || localeHeader === undefined) {
    return DEFAULT_LOCALE;
  }

  const requested = localeHeader
    .split(",")
    .map((part) => {
      const [tagPart, ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="));
      const parsedQuality = quality === undefined ? 1 : Number(quality.slice(2));
      return {
        tag: tagPart?.trim().toLowerCase() ?? "",
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      };
    })
    .filter((item) => item.tag.length > 0 && item.quality > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const item of requested) {
    const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === item.tag);
    if (exact !== undefined) {
      return exact;
    }

    const primary = item.tag.split("-", 1)[0];
    const languageMatch = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split("-", 1)[0] === primary);
    if (languageMatch !== undefined) {
      return languageMatch;
    }
  }

  return DEFAULT_LOCALE;
}

function renderSharePage(record: ShareRecord, route: PublicRoute, localeHeader?: string | null): string {
  const locale = resolveLocale(localeHeader);
  const copy = COPY[locale];
  const isEpisode = record.kind === "episode";
  const title = isEpisode ? record.episodeTitle ?? copy.sharedEpisode : record.podcastTitle;
  const subtitle = isEpisode ? record.podcastTitle : record.podcastAuthor;
  const description = isEpisode
    ? `${title} — ${record.podcastTitle}`
    : record.podcastAuthor === null
      ? record.podcastTitle
      : `${record.podcastTitle} — ${record.podcastAuthor}`;
  const originalURL = isEpisode
    ? record.episodeWebpageURL ?? record.podcastWebpageURL
    : record.podcastWebpageURL;
  const canonicalPath = isEpisode ? "e" : "p";
  const positionQuery = route.startTimeSeconds === null
    ? ""
    : `?t=${route.startTimeSeconds}`;
  const canonicalURL = `${CANONICAL_ORIGIN}/${canonicalPath}/${record.id}${positionQuery}`;
  const metadata = renderMetadata(record, route, locale, copy);

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHTML(description)}">
    <meta name="theme-color" content="#EC4890">
    <meta property="og:title" content="${escapeHTML(title)}">
    <meta property="og:description" content="${escapeHTML(description)}">
    <meta property="og:type" content="${isEpisode ? "article" : "website"}">
    <meta property="og:url" content="${canonicalURL}">
    <meta property="og:image" content="${CANONICAL_ORIGIN}/assets/jollypod-icon-512.png">
    <link rel="canonical" href="${canonicalURL}">
    <link rel="icon" href="/assets/jollypod-icon-180.png">
    <link rel="apple-touch-icon" href="/assets/jollypod-icon-180.png">
    <link rel="stylesheet" href="/assets/style.css?v=20260823-2">
    <title>${escapeHTML(title)} — JollyPod</title>
  </head>
  <body>
    <main class="shared-link-page shell">
      <article class="shared-link-card">
        <a class="shared-link-brand" href="/" aria-label="JollyPod home">
          <img src="/assets/jollypod-icon-180.png" alt="" width="52" height="52">
          <span>JollyPod</span>
        </a>
        <p class="eyebrow shared-link-eyebrow">${isEpisode ? copy.sharedEpisode : copy.sharedPodcast}</p>
        <h1>${escapeHTML(title)}</h1>
        ${subtitle === null ? "" : `<p class="shared-link-subtitle">${escapeHTML(subtitle)}</p>`}
        ${metadata}
        <div class="actions shared-link-actions">
          <a class="button button-primary" href="${canonicalURL}">${copy.openInJollyPod}</a>
          <a class="button button-secondary" href="${TESTFLIGHT_URL}">${copy.getJollyPod}</a>
          ${originalURL === null ? "" : `<a class="button button-secondary" href="${escapeHTML(originalURL)}" rel="noreferrer noopener">${copy.originalWebsite}</a>`}
        </div>
        <p class="shared-link-safety">${copy.safety}</p>
      </article>
    </main>
  </body>
</html>`;
}

function renderMetadata(
  record: ShareRecord,
  route: PublicRoute,
  locale: LocaleCode,
  copy: SharePageCopy,
): string {
  const items: string[] = [];
  if (record.publishedAt !== null) {
    const date = new Date(record.publishedAt * 1000);
    items.push(`<span>${copy.publishedPrefix} ${escapeHTML(new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(date))}</span>`);
  }
  if (record.durationSeconds !== null) {
    items.push(`<span>${formatDuration(record.durationSeconds)}</span>`);
  }
  if (route.startTimeSeconds !== null) {
    items.push(`<span>${copy.sharedFromPrefix} ${formatDuration(route.startTimeSeconds)}</span>`);
  }
  return items.length === 0
    ? ""
    : `<div class="shared-link-metadata">${items.join("")}</div>`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderNotFoundPage(localeHeader?: string | null): string {
  const locale = resolveLocale(localeHeader);
  return renderErrorPage(COPY[locale].notFoundMessage, localeHeader);
}

function renderErrorPage(message: string, localeHeader?: string | null): string {
  const copy = COPY[resolveLocale(localeHeader)];
  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#EC4890">
    <link rel="icon" href="/assets/jollypod-icon-180.png">
    <link rel="stylesheet" href="/assets/style.css?v=20260823-2">
    <title>${copy.linkUnavailableTitle} — JollyPod</title>
  </head>
  <body>
    <main class="shared-link-page shell">
      <article class="shared-link-card">
        <a class="shared-link-brand" href="/">
          <img src="/assets/jollypod-icon-180.png" alt="" width="52" height="52">
          <span>JollyPod</span>
        </a>
        <p class="eyebrow shared-link-eyebrow">${copy.linkUnavailableEyebrow}</p>
        <h1>${copy.nothingToOpen}</h1>
        <p class="shared-link-subtitle">${escapeHTML(message)}</p>
        <div class="actions shared-link-actions">
          <a class="button button-primary" href="/">${copy.visitJollyPod}</a>
        </div>
      </article>
    </main>
  </body>
</html>`;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}
