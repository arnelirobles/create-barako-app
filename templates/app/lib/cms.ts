import { createClient, type PublicContent } from "@baryodev/barako-client";

/*
 * The read path. No auth: the public delivery API serves published entries of a content type that
 * has been opted in, and nothing else. Delivery is off by default on every type, which is why the
 * seed applies a blueprint that turns it on for the ones this site renders.
 *
 * Called from server components, so it uses the compose service name when there is one.
 */
const baseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:5005";

export const cms = createClient({ baseUrl });

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  publishedAt?: string;
  coverImage?: string;
  coverImageAlt?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/*
 * Field names come from the blueprint, so they are PascalCase and they are stable: they are what
 * `POST /api/content-types/blueprints/blog` created. Rename a field in the console and this is the
 * one place to change.
 */
export function toPost(c: PublicContent): Post {
  const d = c.data;
  return {
    id: c.id,
    slug: c.slug ?? str(d.Slug),
    title: str(d.Title) || "Untitled",
    excerpt: str(d.Excerpt) || undefined,
    body: str(d.Body),
    publishedAt: str(d.PublishedAt) || c.createdAt || undefined,
    coverImage: str(d.CoverImage) || undefined,
    coverImageAlt: str(d.CoverImageAlt) || undefined,
  };
}

export async function listPosts(): Promise<Post[]> {
  const res = await cms.public.list("post", { page: 1, pageSize: 20 });
  return res.items
    .map(toPost)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getPost(slug: string): Promise<Post | null> {
  const c = await cms.public.bySlug("post", slug);
  return c ? toPost(c) : null;
}

export function formatDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
