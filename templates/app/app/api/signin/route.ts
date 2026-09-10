import { NextResponse, type NextRequest } from "next/server";
import { signIn, setSession, isSecureRequest } from "@/lib/session";

/*
 * A form post, not a fetch from client-side JavaScript.
 *
 * The password goes from the browser to this server once, this server exchanges it with the API,
 * and the browser gets back an http-only cookie. Nothing in the page ever holds a credential or a
 * token, so there is nothing for injected script to read.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  const session = await signIn(username, password);
  if (!session) {
    // No detail in the redirect: which half was wrong is not something to tell an anonymous caller.
    return NextResponse.redirect(new URL("/signin?error=1", request.url), { status: 303 });
  }

  await setSession(session, isSecureRequest(request));
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
