import { ClientPostgreSQL } from "./deps.ts";

const client = new ClientPostgreSQL({
  user: "user",
  password: "userpassword",
  database: "models",
  hostname: "localhost",
  port: 54320,
  tls: {
    enforce: false,
  },
});

export default {
  client,
  migrationFolders: ["./db/migrations"],
  seedFolders: ["./db/seeds"],
};
