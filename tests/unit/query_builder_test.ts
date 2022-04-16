import { UserModel } from "../user_model.ts";
import { assertEquals } from "../deps.ts";
import { test } from "../utils.ts";
import { QueryBuilder } from "../../mod.ts";

Deno.test("count()", async (t) => {
  await test(t, "Counts number of records", async () => {
    const user1 = await UserModel.factory();
    await UserModel.factory();
    await UserModel.factory();
    const result = await (new QueryBuilder(UserModel, {})).where(
      "id",
      ">",
      user1.id - 1,
    ).count();
    assertEquals(result, 3);
  });
});

Deno.test({
  name: "delete()",
  fn: async (t) => {
    await test(t, "Will delete rows", async () => {
      const user1 = await UserModel.factory();
      const user2 = await UserModel.factory();
      await UserModel.factory();
      await (new QueryBuilder(UserModel, {})).whereIn("id", [
        user1.id,
        user2.id,
      ]).delete();
      assertEquals(
        await UserModel.count(),
        1,
      );
    });
  },
});

Deno.test({
  name: "update()",
  fn: async (t) => {
    await test(t, "Should update rows", async () => {
      const user1 = await UserModel.factory();
      const user2 = await UserModel.factory();
      const updatedModels = await (new QueryBuilder(UserModel, {})).whereIn(
        "id",
        [user1.id, user2.id],
      ).update({
        username: "Not drashland",
      });
      await (new QueryBuilder(UserModel, {})).where("id", user2.id).update({
        is_admin: false,
      });
      assertEquals(updatedModels[0].username, "Not drashland");
      assertEquals(updatedModels[1].username, "Not drashland");
      await user2.refresh();
      assertEquals(user2.is_admin, false);
    });
  },
});

Deno.test("latest()", async (t) => {
  await test(t, "Should find the latest row", async () => {
    const user1 = await UserModel.factory();
    const user2 = await UserModel.factory();
    await UserModel.factory({
      username: "Hello",
    });
    const result = await (new QueryBuilder(UserModel, {})).whereIn("id", [
      user1.id,
      user2.id,
    ]).latest() as UserModel;
    assertEquals(result instanceof UserModel, true);
    assertEquals(result.id, user2.id);
  });
});

Deno.test("first()", async (t) => {
  await test(t, "Should find the first row", async () => {
    const user1 = await UserModel.factory();
    const user2 = await UserModel.factory();
    await UserModel.factory({
      username: "Hello",
    });
    const result1 = await (new QueryBuilder(UserModel, {})).where(
      "id",
      user2.id,
    ).first() as UserModel;
    const result2 = await (new QueryBuilder(UserModel, {}))
      .first() as UserModel;
    assertEquals(result1.id, user2.id);
    assertEquals(result2.id, user1.id);
  });
});

Deno.test({
  name: "all()",
  fn: async (t) => {
    await test(t, "Should find all rows", async () => {
      const user1 = await UserModel.factory();
      const user2 = await UserModel.factory();
      const user3 = await UserModel.factory({
        username: "Hello",
      });
      const result1 = await (new QueryBuilder(UserModel, {})).where(
        "id",
        ">",
        user1.id,
      ).all() as UserModel[];
      const result2 = await (new QueryBuilder(UserModel, {}))
        .all() as UserModel[];
      assertEquals(result1.length, 2);
      assertEquals(result1[0].id, user2.id);
      assertEquals(result2.length, 3);
      assertEquals(result2.map((r) => r.id), [user1.id, user2.id, user3.id]);
    });
  },
});

Deno.test({
  name: "where()",
  fn: async (t) => {
    await test(t, "Should add where constraints", async () => {
      const user1 = await UserModel.factory();
      const user2 = await UserModel.factory();
      const user3 = await UserModel.factory({
        username: "Hello",
      });
      const userGroup1 = await (new QueryBuilder(UserModel, {}))
        .where("username", "Drashland")
        .where("is_admin", true)
        .all();
      assertEquals(userGroup1.length, 2);
      assertEquals(userGroup1.map((r) => r.id), [user1.id, user2.id]);
      const userGroup2 = await (new QueryBuilder(UserModel, {})).where(
        "id",
        user3.id,
      ).all() as UserModel[];
      assertEquals(userGroup2.length, 1);
      assertEquals(userGroup2.map((r) => r.id), [user3.id]);
    });
  },
});

Deno.test({
  name: "select()",
  fn: async (t) => {
    await test(t, "Should select specific fields", async () => {
      const user1 = await UserModel.factory();
      const result = await (new QueryBuilder(UserModel, {})).select("username")
        .where("id", user1.id).first() as UserModel;
      assertEquals({
        ...result,
      }, {
        created_at: "",
        id: 0,
        is_admin: false,
        tablename: "users",
        updated_at: "",
        username: "Drashland",
      });
    });
  },
});

Deno.test("limit()", async (t) => {
  await test(t, "Should limit number of records", async () => {
    const _user1 = await UserModel.factory();
    const _user2 = await UserModel.factory();
    const _user3 = await UserModel.factory();
    const _user4 = await UserModel.factory();
    const result = await (new QueryBuilder(UserModel, {})).limit(2).all();
    assertEquals(result.length, 2);
    result.forEach((r) => assertEquals(r instanceof UserModel, true));
  });
});

Deno.test("whereIn()", async (t) => {
  await test(t, "Should apply whereIn constraints", async () => {
    const _user1 = await UserModel.factory();
    const user2 = await UserModel.factory();
    const user3 = await UserModel.factory();
    const user4 = await UserModel.factory();
    const result = await (new QueryBuilder(UserModel, {}))
      .whereIn("id", [user2.id, user3.id, user4.id])
      .all();
    assertEquals(result.length, 3);
    result.forEach((r) => assertEquals(r instanceof UserModel, true));
  });
});

Deno.test("offset()", async (t) => {
  await test(t, "Should offset an amount", async () => {
    await UserModel.factory();
    await UserModel.factory();
    await UserModel.factory();
    await UserModel.factory();
    const result = await (new QueryBuilder(UserModel, {}))
      .offset(3)
      .all();
    assertEquals(result.length, 1);
    result.forEach((r) => assertEquals(r instanceof UserModel, true));
  });
});

Deno.test("orderBy()", async (t) => {
  await test(t, "Should order by", async () => {
    const user1 = await UserModel.factory();
    await UserModel.factory();
    await UserModel.factory();
    const user4 = await UserModel.factory();
    const result = await (new QueryBuilder(UserModel, {}))
      .orderBy(["id", "desc"])
      .all();
    assertEquals(result.length, 4);
    assertEquals(result[0].id, user4.id);
    assertEquals((result.at(-1) as UserModel).id, user1.id);
    result.forEach((r) => assertEquals(r instanceof UserModel, true));
  });
});
