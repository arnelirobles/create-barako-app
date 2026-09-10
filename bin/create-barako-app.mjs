#!/usr/bin/env node
/*
 * create-barako-app
 *
 * Generates a Next.js project with a docker compose that brings up barakoCMS and barakoBrew
 * alongside it, seeded with real content, with sign in and sign out already working.
 *
 * No dependencies on purpose. This runs through `npm create`, which means it is downloaded and
 * executed before the user has agreed to anything, so it reads from stdin, writes files, and uses
 * nothing but the Node standard library.
 */

import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { stdin, stdout, argv, exit } from "node:process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "app");

/*
 * Pinned, never "latest".
 *
 * barakoCMS publishes X-Api-Contract-Version and moves it when the HTTP surface breaks a consumer.
 * barakoBrew declares the range it speaks and refuses to run outside it. A generated project on a
 * moving tag therefore breaks on somebody else's release day, in a repository they own, with no
 * change of their own to explain it. These two are known to work together.
 */
const API_TAG = "4.0.1";
const CONSOLE_TAG = "1.0.0";
const CLIENT_VERSION = "0.3.0";

const BLUEPRINTS = [
  { key: "blog", label: "Blog: posts with an author and a category, plus pages" },
  { key: "portfolio", label: "Portfolio: projects and case studies" },
  { key: "events", label: "Events: an events site with venues" },
  { key: "docs", label: "Docs: a documentation site" },
  { key: "none", label: "Nothing: an empty schema, model it yourself" },
];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  indigo: (s) => `\x1b[38;5;99m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

function die(message) {
  stdout.write(`\n${c.red("create-barako-app:")} ${message}\n`);
  exit(1);
}

/* A password safe to paste into a shell, a .env and a URL without quoting it. */
function secret(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

function isEmptyEnough(dir) {
  if (!existsSync(dir)) return true;
  const allowed = new Set([".git", ".gitignore", ".DS_Store", "README.md", "LICENSE"]);
  return readdirSync(dir).every((f) => allowed.has(f));
}

/*
 * Substitutes {{TOKEN}} in every generated file.
 *
 * Deliberately not a template engine. Anything that needs a conditional gets its own file and is
 * copied or not copied, because a template language in a starter is a second thing to learn before
 * the first line of the project's own code.
 */
function render(dir, vars) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      render(path, vars);
      continue;
    }
    let text = readFileSync(path, "utf8");
    for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v);
    writeFileSync(path, text);
  }
}

/* --flag=value and --flag, so a script or a CI job never has to answer a prompt. */
function parseFlags(args) {
  const flags = {};
  for (const a of args) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    flags[k] = v ?? true;
  }
  return flags;
}

const USAGE = `
  npm create barako-app@latest my-site

  --yes                 take every default, ask nothing
  --blueprint=<name>    ${BLUEPRINTS.map((b) => b.key).join(", ")}
  --no-samples          apply the blueprint, create no entries
  --no-console          leave barakoBrew out of docker compose
  --api-port=<n>        default 5005
  --console-port=<n>    default 3001
  --web-port=<n>        default 3000
  --admin=<name>        default admin
`;

async function main() {
  const args = argv.slice(2);
  const flags = parseFlags(args);
  const target = args.find((a) => !a.startsWith("--"));

  stdout.write(`\n${c.indigo(c.bold("create-barako-app"))}  a barakoCMS project that runs\n`);

  if (flags.help) {
    stdout.write(USAGE);
    return;
  }
  if (!target) {
    die(`give it a directory.\n${USAGE}`);
  }

  const dir = resolve(target);
  const name = basename(dir);
  if (!isEmptyEnough(dir)) {
    die(`${dir} is not empty. Pick a new directory, or empty that one first.`);
  }

  /*
   * Prompting needs a terminal.
   *
   * Piped into readline, every buffered line arrives before the second question registers its
   * listener, so answers past the first are dropped and the run ends having done nothing, quietly
   * and with exit 0. Rather than half-work, this refuses: without a TTY the flags are the input.
   * That is also what makes the generator testable on a schedule, which is the difference between
   * a starter that works and one that broke three releases ago and nobody noticed.
   */
  const interactive = stdin.isTTY && !flags.yes;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  const ask = async (q, def) => {
    if (!rl) return def;
    const answer = (await rl.question(`${q} ${c.dim(`(${def})`)} `)).trim();
    return answer || def;
  };
  const confirm = async (q, def = "y") => {
    const answer = String(await ask(q, def)).toLowerCase();
    return answer === "y" || answer === "yes";
  };

  let blueprint = typeof flags.blueprint === "string" ? flags.blueprint : null;
  if (blueprint && !BLUEPRINTS.some((b) => b.key === blueprint)) {
    die(`unknown blueprint "${blueprint}". One of: ${BLUEPRINTS.map((b) => b.key).join(", ")}`);
  }
  if (!blueprint) {
    if (rl) {
      stdout.write(`\n${c.dim("Content model. This applies a blueprint the API already ships.")}\n`);
      BLUEPRINTS.forEach((b, i) => stdout.write(`  ${i + 1}. ${b.label}\n`));
    }
    const pick = await ask("Which one?", "1");
    blueprint = BLUEPRINTS[Number(pick) - 1]?.key ?? "blog";
  }

  const withSamples =
    blueprint === "none" || flags["no-samples"]
      ? false
      : await confirm("Seed a few sample entries so the site is not empty?");
  const withConsole = flags["no-console"]
    ? false
    : await confirm("Include the barakoBrew console in docker compose?");
  const apiPort = flags["api-port"] || (await ask("API port", "5005"));
  const consolePort = flags["console-port"] || (withConsole ? await ask("Console port", "3001") : "3001");
  const webPort = flags["web-port"] || (await ask("Next.js port", "3000"));
  const adminUser = flags.admin || (await ask("Admin username", "admin"));
  if (rl) rl.close();

  mkdirSync(dir, { recursive: true });
  cpSync(TEMPLATES, dir, { recursive: true });

  /*
   * npm refuses to publish a directory containing a .gitignore and silently drops it from the
   * tarball, so the template ships it under another name and it is restored here. Same for the
   * env example, which npm would otherwise treat as the package's own.
   */
  for (const [from, to] of [["_gitignore", ".gitignore"], ["_env.example", ".env.example"]]) {
    const src = join(dir, from);
    if (existsSync(src)) renameSync(src, join(dir, to));
  }

  const adminPassword = secret(12);
  const vars = {
    PROJECT_NAME: name,
    API_TAG,
    CONSOLE_TAG,
    CLIENT_VERSION,
    API_PORT: apiPort,
    CONSOLE_PORT: consolePort,
    WEB_PORT: webPort,
    BLUEPRINT: blueprint,
    ADMIN_USER: adminUser,
  };
  render(dir, vars);

  /*
   * The generated .env carries real secrets and is gitignored. .env.example carries the same keys
   * with empty values. Generating the secrets here rather than asking is the difference between a
   * starter that runs and a starter that stops on step two to make you invent a 32 character key.
   */
  const env = [
    "# Generated by create-barako-app. Real secrets: this file is gitignored, keep it that way.",
    "",
    `DB_PASSWORD=${secret(18)}`,
    `# 32 characters minimum or the API refuses to start.`,
    `JWT_KEY=${secret(36)}`,
    `ADMIN_USERNAME=${adminUser}`,
    `ADMIN_PASSWORD=${adminPassword}`,
    "",
    `API_PORT=${apiPort}`,
    `CONSOLE_PORT=${consolePort}`,
    `WEB_PORT=${webPort}`,
    "",
    "# Where the browser and the Next server reach the API.",
    `NEXT_PUBLIC_CMS_URL=http://localhost:${apiPort}`,
    `CMS_URL=http://api:8080`,
    "",
  ].join("\n");
  writeFileSync(join(dir, ".env"), env);

  if (!withConsole) {
    const compose = join(dir, "compose.yml");
    const text = readFileSync(compose, "utf8");
    writeFileSync(compose, text.replace(/\n  console:[\s\S]*?(?=\n  [a-z]|\nvolumes:)/, "\n"));
  }

  const steps = [
    `cd ${target}`,
    "npm install",
    "docker compose up -d",
    ...(blueprint === "none" ? [] : [`npm run seed${withSamples ? "" : " -- --schema-only"}`]),
    "npm run dev",
  ];

  stdout.write(`\n${c.green("Done.")} ${c.bold(name)} is ready.\n\n`);
  steps.forEach((s) => stdout.write(`  ${c.indigo(s)}\n`));
  stdout.write(`\n${c.dim("Then:")}\n`);
  stdout.write(`  site       http://localhost:${webPort}\n`);
  if (withConsole) stdout.write(`  console    http://localhost:${consolePort}\n`);
  stdout.write(`  API        http://localhost:${apiPort}\n`);
  stdout.write(`\n  sign in as ${c.bold(adminUser)} with the password in ${c.bold(".env")}\n\n`);
}

main().catch((err) => die(err?.message ?? String(err)));
