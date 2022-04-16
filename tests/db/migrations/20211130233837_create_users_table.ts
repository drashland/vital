import { AbstractMigration, ClientPostgreSQL } from "../../deps.ts";

export default class extends AbstractMigration<ClientPostgreSQL> {
  /** Runs on migrate */
  async up(): Promise<void> {
    await this.client.queryObject(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username character varying(50) NOT NULL,
          is_admin bool NOT NULL,
          created_at timestamp without time zone default now(),
          updated_at timestamp without time zone default now()
      );
    `);
  }

  /** Runs on rollback */
  async down(): Promise<void> {
    await this.client.queryObject(`
            DROP table users
        `);
  }
}
