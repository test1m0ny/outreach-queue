// The Supabase project that handles sign-in. The publishable key is public by design.
export const SUPABASE_URL = "https://ribhqpnvteuroiaygino.supabase.co";
export const SUPABASE_KEY = "sb_publishable_0o_e_fcVn7KLtVtBLha8PA_yKKhb-1p";

export type AuthUser = { id: string; email?: string };

// Confirms the bearer token with Supabase and returns the signed-in user, or null.
export async function getUser(req: Request): Promise<AuthUser | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u && u.id ? { id: u.id, email: u.email } : null;
}

export const unauthorized = () => Response.json({ error: "Please sign in again." }, { status: 401 });
