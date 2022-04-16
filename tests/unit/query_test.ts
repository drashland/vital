import { UserModel } from "../user_model.ts";
import { assertEquals } from "../deps.ts";
import { test } from "../utils.ts";
import { queryRaw } from "../../src/query.ts";

Deno.test("queryRaw()", async (t) => {
  await test(t, "correctly queries", async () => {
    const user = await UserModel.factory();
    const result = await queryRaw(`SELECT * FROM users WHERE id = $1`, [
      user.id,
    ]);
    result[0].tablename = "users";
    assertEquals(result, [
      {
        ...user,
      },
    ]);
  });
});
