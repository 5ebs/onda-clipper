import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const ENV_VAR = "FIREBASE_ONDADEV_METRICS_KEY_B64";
const APP_NAME = "ondadev-metrics";

function decodeServiceAccount(): ServiceAccount {
  const b64 = process.env[ENV_VAR];
  if (!b64) throw new Error(`${ENV_VAR} is not set`);
  const json = Buffer.from(b64, "base64").toString("utf-8");
  const parsed = JSON.parse(json) as ServiceAccount & { project_id?: string };
  if (!parsed.projectId && parsed.project_id) {
    parsed.projectId = parsed.project_id;
  }
  return parsed;
}

function appInstance(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp({ credential: cert(decodeServiceAccount()) }, APP_NAME);
}

export function getMetricsAuth(): Auth {
  return getAuth(appInstance());
}

export function getMetricsFirestore(): Firestore {
  return getFirestore(appInstance());
}
