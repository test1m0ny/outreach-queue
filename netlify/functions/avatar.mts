import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getUser, unauthorized } from "../lib/auth.js";

const MAX = 600 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default async (req: Request, context: Context) => {
  const store = getStore("avatars");

  if (req.method === "GET") {
    const id = context.params.id;
    if (!id) return new Response("Not found", { status: 404 });
    const res = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!res) return new Response("Not found", { status: 404 });
    return new Response(res.data, {
      headers: { "content-type": String(res.metadata.type || "image/jpeg"), "cache-control": "public, max-age=300" },
    });
  }

  if (req.method === "POST") {
    const user = await getUser(req);
    if (!user) return unauthorized();
    const type = (req.headers.get("content-type") || "").split(";")[0];
    if (!TYPES.includes(type)) return Response.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 400 });
    const data = await req.arrayBuffer();
    if (data.byteLength > MAX) return Response.json({ error: "That image is too large." }, { status: 413 });
    await store.set(user.id, data, { metadata: { type } });
    return Response.json({ url: `/api/avatar/${user.id}?v=${Date.now()}` });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: ["/api/avatar", "/api/avatar/:id"] };
