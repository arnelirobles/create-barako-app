import { cookies } from "next/headers";
import { createClient, memoryStore } from "@baryodev/barako-client";

/*
 * Sessions live on the server.
 *
 * barakoCMS returns both tokens in the login response body, not only in a cookie, so this app can
 * hold them and set a cookie of its own. Three things follow from that, and they are the reason
 * this file exists rather than the browser calling the API directly:
 *
 *   1. No CMS token is ever in browser JavaScript, so a script injected into a page cannot read it.
 *   2. The browser never calls the API cross-origin, so the site needs no CORS entry.
 *   3. The API's own refresh cookie is Secure outside Development, which means a Production API on
 *      plain http cannot keep a browser session at all. Holding the token here sidesteps that, so
 *      localhost behaves the same way production does.
 */

const COOKIE = "barako_session";

/* Inside compose the Next server reaches the API by service name; the browser cannot. */
const serverUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:5005";

export interface Session {
  token: string;
  refreshToken?: string;
  username: string;
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof s?.token === "string" ? (s as Session) : null;
  } catch {
    /* A cookie we cannot read is a cookie from an older version of this app. Treat it as absent. */
    return null;
  }
}

/*
 * `secure` comes from the request, not from NODE_ENV.
 *
 * A Secure cookie is never sent back over plain http, and `npm start` and the compose stack are
 * both NODE_ENV=production over http, so keying it on the environment means sign in appears to
 * work (303, Set-Cookie) and then the session is silently gone on the next request. Ask what
 * scheme this request actually arrived on, and honour the proxy header, since a deployment behind
 * TLS termination reaches the app as http.
 */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export async function setSession(session: Session, secure: boolean) {
  (await cookies()).set(COOKIE, Buffer.from(JSON.stringify(session)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** Signs in against the API and returns the tokens, or null if the credentials were rejected. */
export async function signIn(username: string, password: string): Promise<Session | null> {
  // login() writes the tokens into the store, so hand the client one we can read back.
  const storage = memoryStore();
  const client = createClient({ baseUrl: serverUrl, storage });
  try {
    await client.auth.login(username, password);
  } catch {
    return null;
  }
  const { token, refreshToken } = storage.get();
  return token ? { token, refreshToken, username } : null;
}

/** A client carrying the signed-in user's token, for anything beyond public content. */
export function clientFor(session: Session) {
  return createClient({
    baseUrl: serverUrl,
    token: session.token,
    refreshToken: session.refreshToken,
  });
}
