import { Pool } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

const globalForDb = globalThis as typeof globalThis & { erpPool?: Pool };

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  if (!globalForDb.erpPool) {
    globalForDb.erpPool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  }
  return globalForDb.erpPool;
}

export async function getUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

export async function getOrganizationContext() {
  const user = await getUser();
  if (!user?.id) return null;
  const result = await getPool().query(
    `SELECT o.id AS organization_id, o.name AS organization_name, o.currency, o.timezone,
            m.role, s.id AS store_id, s.name AS store_name
     FROM public.organization_members m
     JOIN public.organizations o ON o.id=m.organization_id
     LEFT JOIN LATERAL (
       SELECT id,name FROM public.stores WHERE organization_id=o.id ORDER BY created_at LIMIT 1
     ) s ON true
     WHERE m.user_id=$1 AND m.status='active'
     ORDER BY m.created_at LIMIT 1`,
    [user.id]
  );
  return result.rows[0] ? { user, ...result.rows[0] } : { user, organization_id: null };
}

export function roleAllowed(role: string, allowed: string[]) {
  return allowed.includes(role);
}
