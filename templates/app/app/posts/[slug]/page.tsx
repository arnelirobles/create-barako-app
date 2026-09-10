import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, formatDate } from "@/lib/cms";

export const dynamic = "force-dynamic";

/*
 * Markdown arrives as markdown, because the blueprint types Body as markdown. Rendering it is left
 * to you: pick a parser you trust, sanitise it, and remember that content written by an editor is
 * not automatically safe to inject. Whitespace is preserved here so the raw text stays readable
 * rather than collapsing into one paragraph.
 */
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article>
      <p className="meta">
        <Link href="/">Back</Link>
      </p>
      <h1>{post.title}</h1>
      <p className="meta" style={{ marginBottom: "2rem" }}>
        <time>{formatDate(post.publishedAt)}</time> <span className="mono">/{post.slug}</span>
      </p>

      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.coverImageAlt ?? ""}
          style={{ width: "100%", borderRadius: "var(--radius-card)", marginBottom: "1.5rem" }}
        />
      )}

      <div style={{ whiteSpace: "pre-wrap" }}>{post.body}</div>
    </article>
  );
}
