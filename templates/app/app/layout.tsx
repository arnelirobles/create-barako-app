import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "{{PROJECT_NAME}}",
  description: "A barakoCMS site.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Manrope:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            {{PROJECT_NAME}}
          </Link>
          <nav>
            {session ? (
              <form action="/api/signout" method="post" style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                <span className="meta mono">{session.username}</span>
                <button className="btn ghost" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <Link className="btn" href="/signin">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
