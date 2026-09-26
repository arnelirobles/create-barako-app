# create-barako-app

Generates a Next.js project running on [barakoCMS](https://github.com/BaryoDev/barakoCMS): a docker
compose that brings up the API, the [barakoBrew](https://github.com/BaryoDev/barakoBrew) console and
the [barakoPress](https://github.com/BaryoDev/barakoPress) renderer, a content model applied from a
blueprint, the `site` settings the renderer reads, published sample entries, and sign in and sign
out already working.

```bash
npm create barako-app@latest my-site
cd my-site
npm install
docker compose up -d
npm run seed
npm run dev
```

Five commands to a site rendering its own content, with an admin console and a second rendering of
the same content next to it. CI runs those same five against the pinned images on every push and
nightly, so if that sequence stops working the build here goes red before anybody's first run does.

| 0.2.0 pins | Image |
| --- | --- |
| barakoCMS 4.4.1 | `ghcr.io/baryodev/barako-cms` |
| barakoBrew 1.5.0 | `ghcr.io/baryodev/barako-brew` |
| barakoPress 0.8.0 | `ghcr.io/baryodev/barako-press` |
| barako-client 0.3.0 | `@baryodev/barako-client`, used by the Next.js app |

The generated README says how to move those tags later, including the database check a barakoCMS
upgrade needs before the new version starts.

## Options

Prompts by default. Without a terminal, or with `--yes`, the flags are the input.

```
--yes                 take every default, ask nothing
--blueprint=<name>    blog, portfolio, events, docs, none
--no-samples          apply the blueprint, create no entries
--no-console          leave barakoBrew out of docker compose
--no-press            leave barakoPress out of docker compose
--api-port=<n>        default 5005
--console-port=<n>    default 3001
--press-port=<n>      default 3002
--web-port=<n>        default 3000
--admin=<name>        default admin
```

## What it decides for you, and why

**Secrets are generated, not requested.** The `.env` is written with a real database password, a
36 byte JWT key and an admin password. A starter that stops on step two to make you invent a 32
character key is a starter people abandon on step two.

**The renderer needs no code.** barakoPress runs from its published image and reads who the site is
from the `site` entry the seed publishes. On localhost no domain is mapped to a tenant, so it falls
back to `default`, the tenant a single install creates. Rename the site or change its theme in the
console, under that entry.

**The demo seed is off.** `Seed__DemoContent` seeds an attendance content type and a workflow that
mails whatever its Email field holds, and it defaults to on in the Development environment. The
generated compose runs Production and sets it to `false` explicitly. Content comes from a blueprint
the API already ships (`blog`, `docs`, `events`, `portfolio`) plus a few entries the seed publishes.

**The session lives on the Next server.** barakoCMS returns both tokens in the login response body,
so the app holds them and hands the browser an http-only cookie of its own. No API token is readable
from page JavaScript, the browser never calls the API cross-origin, and the API's own `Secure`
refresh cookie is not in the way on http. The cookie's own `Secure` flag comes from the request
scheme rather than from `NODE_ENV`, because `npm start` is a production build over http and keying
it on the environment drops the session silently.

**Image tags are pinned.** barakoCMS publishes `X-Api-Contract-Version` and moves it when the HTTP
surface breaks a consumer; the console declares the range it speaks and refuses to run outside it.
On `latest`, a generated project breaks on somebody else's release day.

## What it does not do

No design system, no state library, no ORM, no component kit. The palette in `app/globals.css` is
custom properties you can delete in one commit. The generated project is a working shape, not a
template to delete your way out of.

## Licence

MIT.
