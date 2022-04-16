import { AbstractSeed, ClientPostgreSQL } from "../../deps.ts";
import { UserModel } from "../../user_model.ts";

export default class extends AbstractSeed<ClientPostgreSQL> {
  /** Runs on seed */
  async run(): Promise<void> {
    await UserModel.factory({
      username: `John`,
      tags: [],
    });
  }
}
