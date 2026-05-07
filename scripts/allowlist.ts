/**
 * Manage the shared allowlist (lives in the ondadev-metrics Firestore).
 * Mirrors `onda-dev/scripts/allowlist.mjs`.
 *
 *   npm run allowlist add --email you@example.com
 *   npm run allowlist remove --email you@example.com
 *   npm run allowlist list
 */
import { getMetricsFirestore } from "../lib/firebase-admin";

async function main() {
  const cmd = process.argv[2];
  const idx = process.argv.indexOf("--email");
  const email = idx > -1 ? process.argv[idx + 1]?.toLowerCase() : null;

  const db = getMetricsFirestore();

  if (cmd === "add") {
    if (!email) throw new Error("--email required");
    await db.doc(`allowlist/${email}`).set(
      {
        email,
        addedAt: new Date(),
        addedBy: "scripts/allowlist.ts",
      },
      { merge: true },
    );
    console.log(`added ${email}`);
    return;
  }

  if (cmd === "remove") {
    if (!email) throw new Error("--email required");
    await db.doc(`allowlist/${email}`).delete();
    console.log(`removed ${email}`);
    return;
  }

  if (cmd === "list") {
    const snap = await db.collection("allowlist").get();
    snap.forEach((d) => console.log(d.id));
    return;
  }

  console.error("usage: allowlist <add|remove|list> [--email <email>]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
