import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// `next build` collects page data by importing every route module
// before runtime env is available. Throwing at module load (the obvious
// "DATABASE_URL is not set" check) breaks the build. postgres-js doesn't
// connect until the first query anyway, so we let module load succeed
// with a placeholder and let the connection error surface at first use.
const url =
  process.env.DATABASE_URL ?? "postgres://buildtime@buildtime/buildtime";

const client = postgres(url, { max: 10, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
