import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <>
      <h1>Sign in</h1>
      <p className="meta" style={{ marginBottom: "2rem" }}>
        Against the API, from the server. The token never reaches the browser.
      </p>

      {error && (
        <div className="notice error">
          Those credentials were refused. The admin username and password are in this project&apos;s
          <code> .env</code>.
        </div>
      )}

      <form action="/api/signin" method="post" className="card" style={{ maxWidth: "22rem" }}>
        <label className="field">
          <span>Username</span>
          <input name="username" autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>
    </>
  );
}
