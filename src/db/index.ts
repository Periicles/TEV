import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// On Vercel Fluid compute, lets idle clients be released before a function instance is suspended.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
