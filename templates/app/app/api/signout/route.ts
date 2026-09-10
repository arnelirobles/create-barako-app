import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/lib/session";

/*
 * POST, not GET. A sign-out on GET can be triggered by any page that can make the browser fetch a
 * URL, including an image tag on someone else's site, which is a small but real way to annoy a
 * signed-in user.
 */
export async function POST(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
