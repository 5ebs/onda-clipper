import "server-only";
import { getMetricsFirestore } from "@/lib/firebase-admin";

export async function checkAllowlist(email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();
  if (!key) return false;
  const snap = await getMetricsFirestore().doc(`allowlist/${key}`).get();
  return snap.exists;
}
