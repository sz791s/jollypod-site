import { env } from "cloudflare:workers";
import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { beforeEach } from "vitest";

const testEnv = env as Env & { TEST_MIGRATIONS: D1Migration[] };

beforeEach(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
  await testEnv.DB.exec("DELETE FROM share_links");
});
