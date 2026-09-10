import Link from "next/link";
import { listPosts, formatDate, type Post } from "@/lib/cms";

/*
 * Read on every request rather than at build time. A CMS-backed site where an edit needs a rebuild
 * is a static site with extra steps, and the point of the console is that a change is live.
 */
export const dynamic = "force-dynamic";

function Card({ post }: { post: Post }) {
  return (
    <article className="card">
      <h2>
        <Link href={`/posts/${post.slug}`}>{post.title}</Link>
      </h2>
      <p className="meta">
        <time>{formatDate(post.publishedAt)}</time> <span className="mono">/{post.slug}</span>
      </p>
      {post.excerpt && <p style={{ marginBottom: 0 }}>{post.excerpt}</p>}
    </article>
  );
}

function Empty() {
  return (
    <div className="notice">
      <p style={{ marginTop: 0 }}>
        <strong>Nothing published yet.</strong>
      </p>
      <p style={{ marginBottom: 0 }}>
        Run <code>npm run seed</code> to apply the content blueprint and publish a few entries, or
        write one in the console. Only <em>published</em> entries of a type that is opted into
        delivery reach this page.
      </p>
    </div>
  );
}

export default async function Home() {
  let posts: Post[] = [];
  let failure: string | null = null;

  try {
    posts = await listPosts();
  } catch (e) {
    /*
     * The API being unreachable is the single most likely thing to be wrong on a first run, so it
     * gets a real message rather than a stack trace on a blank page.
     */
    failure = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <h1>{{PROJECT_NAME}}</h1>
      <p className="meta" style={{ marginBottom: "2rem" }}>
        Served from barakoCMS through <code>GET /api/public/post</code>.
      </p>

      {failure && (
        <div className="notice error">
          <p style={{ marginTop: 0 }}>
            <strong>The API did not answer.</strong>
          </p>
          <p>
            <code>{failure}</code>
          </p>
          <p style={{ marginBottom: 0 }}>
            Check <code>docker compose ps</code>, then <code>docker compose logs api</code>.
          </p>
        </div>
      )}

      {!failure && posts.length === 0 && <Empty />}
      {posts.map((p) => (
        <Card key={p.id} post={p} />
      ))}
    </>
  );
}
