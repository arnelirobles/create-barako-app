#!/usr/bin/env node
/*
 * Seeds this project's CMS: applies a content blueprint, then creates a few published entries.
 *
 * Plain fetch, not the typed client, on purpose. Applying a blueprint is not part of the client's
 * surface, so this script talks HTTP for that step regardless, and doing the whole job one way is
 * easier to read than half of it through a wrapper. It is also the step most likely to be replaced
 * later by `barako apply -f`, and a small script is easier to delete than a dependency.
 *
 *   node seed/seed.mjs                 apply the blueprint and create sample entries
 *   node seed/seed.mjs --schema-only   apply the blueprint, create nothing
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exit, argv, env } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const schemaOnly = argv.includes("--schema-only");

/* Node's --env-file is not on every version people have installed, so read it here. */
function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* No .env is fine if the values are already in the environment. */
  }
  return { ...out, ...env };
}

const cfg = readEnv();
const API = cfg.NEXT_PUBLIC_CMS_URL ?? "http://localhost:5005";
const USER = cfg.ADMIN_USERNAME ?? "admin";
const PASS = cfg.ADMIN_PASSWORD;
const BLUEPRINT = "{{BLUEPRINT}}";

const say = (s) => console.log(`  ${s}`);
function die(msg) {
  console.error(`\nseed: ${msg}\n`);
  exit(1);
}

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* Several paths answer text/plain: a 429, an API key refusal, a feed 503. Keep the body. */
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/* The API is up before it is ready: the schema runs on start. Wait for /health, not for the port. */
async function waitForApi() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    if (i === 0) say(`waiting for ${API}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  die(`${API} never became healthy. Is docker compose up? Check: docker compose logs api`);
}

const SAMPLES = [
  {
    Title: "Your first post",
    Slug: "your-first-post",
    Excerpt: "Created by the seed script, published, and served through the public delivery API.",
    Body: [
      "This entry was created by `npm run seed` and published, which is why it is on the home page.",
      "",
      "It is real content in Postgres, not a fixture in this repository. Open the console, change",
      "this text, save, and reload the page.",
      "",
      "## What is actually happening",
      "",
      "The home page calls `GET /api/public/post`. That route is anonymous, and it serves only",
      "published entries of a content type that has been opted into delivery. Delivery is off by",
      "default on every type: the blueprint this project applied turned it on for `post`.",
    ].join("\n"),
    PublishedAt: new Date().toISOString(),
  },
  {
    Title: "Editing content without touching the code",
    Slug: "editing-without-code",
    Excerpt: "The content model is data, so a new field does not need a deploy.",
    Body: [
      "Content types here are defined at runtime. Adding a field to `post` is a change in the",
      "console, not a migration and not a rebuild.",
      "",
      "The one place this project cares about a field name is `lib/cms.ts`, which maps the stored",
      "entry onto the shape the pages render. Rename a field and that is the file to change.",
    ].join("\n"),
    PublishedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    Title: "Where to go next",
    Slug: "where-to-go-next",
    Excerpt: "Sign in, the delivery API, and what this starter deliberately leaves out.",
    Body: [
      "Sign in at `/signin` with the admin credentials in your `.env`. The session is held by the",
      "Next server and handed to the browser as an http-only cookie, so no API token is ever",
      "readable from JavaScript on the page.",
      "",
      "This starter ships no design system, no state library and no ORM. That is deliberate. It is",
      "a working shape to build on, not a template to delete your way out of.",
    ].join("\n"),
    PublishedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

async function main() {
  if (!PASS) die("ADMIN_PASSWORD is not set. It should be in .env, written when the project was generated.");

  await waitForApi();

  const login = await api("/api/auth/login", { method: "POST", body: { username: USER, password: PASS } });
  if (!login.ok || !login.body?.token) {
    die(`sign in as "${USER}" failed with ${login.status}. Check ADMIN_USERNAME and ADMIN_PASSWORD in .env.`);
  }
  const token = login.body.token;
  say(`signed in as ${USER}`);

  const existing = await api("/api/content-types?page=1&pageSize=100", { token });
  const names = new Set(
    (Array.isArray(existing.body?.items) ? existing.body.items : []).map((t) => String(t.name ?? "").toLowerCase()),
  );

  if (names.has("post")) {
    say(`blueprint "${BLUEPRINT}" already applied, leaving the schema alone`);
  } else {
    const applied = await api(`/api/content-types/blueprints/${BLUEPRINT}`, { method: "POST", token });
    if (!applied.ok) {
      die(`applying blueprint "${BLUEPRINT}" failed with ${applied.status}: ${JSON.stringify(applied.body)}`);
    }
    const created = applied.body?.created ?? [];
    say(`applied "${BLUEPRINT}": ${created.map((t) => t.name).join(", ")}`);
    const notPublic = created.filter((t) => !t.isPubliclyDeliverable).map((t) => t.name);
    if (notPublic.length) {
      say(`not served publicly (by design): ${notPublic.join(", ")}`);
    }
  }

  if (schemaOnly) {
    say("schema only, no entries created");
    return;
  }

  let made = 0;
  for (const data of SAMPLES) {
    const res = await api("/api/contents", {
      method: "POST",
      token,
      // Draft is the default. An entry has to be Published to reach the delivery API at all.
      body: { contentType: "post", data, status: "Published" },
    });
    if (res.ok) {
      made++;
    } else if (res.status === 409) {
      say(`"${data.Slug}" already exists, skipped`);
    } else {
      die(`creating "${data.Slug}" failed with ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }
  say(`${made} entries published`);
}

main().catch((e) => die(e?.message ?? String(e)));
