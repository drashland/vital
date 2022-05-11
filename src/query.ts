import { config, PostgresClient } from "../deps.ts";
import type { ClientOptions } from "../deps.ts";
const env = config();

const dbConfig: ClientOptions = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  hostname: env.DB_HOSTNAME,
  port: env.DB_PORT,
  tls: {
    enforce: env.DB_ENABLE_TLS === "true",
  },
};
const caCertificates = env.DB_CA_CERTIFICATES
  ? env.DB_CA_CERTIFICATES.split(",")
  : [];
if (caCertificates.length) {
  dbConfig.tls!.caCertificates = caCertificates;
}

export async function queryRaw(
  query: string,
  args: Array<unknown> = [],
) {
  const db = new PostgresClient(dbConfig);
  await db.connect();
  const dbResult = args && args.length
    ? await db.queryObject(query, ...args)
    : await db.queryObject(query);
  await db.end();
  return dbResult.rows as Record<string, unknown>[];
}
