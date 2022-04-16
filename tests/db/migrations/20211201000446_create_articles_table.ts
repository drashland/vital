import { AbstractMigration, ClientPostgreSQL } from "../../deps.ts";

export default class extends AbstractMigration<ClientPostgreSQL> {
  /** Runs on migrate */
  async up(): Promise<void> {
    await this.client.queryObject(`
      CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
          title character varying(255) NOT NULL,
          created_at timestamp without time zone NOT NULL default now(),
          updated_at timestamp without time zone default now(),
          tags text[]
      );
    `);
  }

  /** Runs on rollback */
  async down(): Promise<void> {
    await this.client.queryObject(`
            DROP TABLE articles
        `);
  }
}
