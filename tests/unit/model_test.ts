import { UserModel } from "../user_model.ts";
import { assertEquals } from "../deps.ts";
import { test } from "../utils.ts";
import { ArticleModel } from "../article_model.ts";

Deno.test("factory()", async (t) => {
  await test(t, "Uses factory defaults", async () => {
    const user = await UserModel.factory();
    const dbUser = await UserModel.latest() as UserModel;
    assertEquals(dbUser instanceof UserModel, true);
    const factoryDefaults = Reflect.get(new UserModel(), "factoryDefaults");
    Object.keys(factoryDefaults).forEach((field) => {
      assertEquals(dbUser[field], factoryDefaults[field]);
    });
    assertEquals(dbUser, user);
  });

  await test(t, "Uses passed in values", async () => {
    const user = await UserModel.factory({
      is_admin: false,
    });
    const dbUser = await UserModel.latest() as UserModel;
    assertEquals(dbUser instanceof UserModel, true);
    const factoryDefaults = Reflect.get(new UserModel(), "factoryDefaults");
    Object.keys(factoryDefaults).forEach((field) => {
      if (field === "is_admin") {
        assertEquals(dbUser[field], false);
      }
      assertEquals(dbUser[field], factoryDefaults[field]);
    });
    assertEquals(dbUser, user);
  });
});

Deno.test("all()", async (t) => {
  await test(t, "Fetches all records", async () => {
    await UserModel.factory();
    await UserModel.factory();
    const users = await UserModel.all();
    assertEquals(users.length, 2);
  });
});

Deno.test("latest()", async (t) => {
  await test(t, "Grabs the latest of a model", async () => {
    await UserModel.factory();
    const user2 = await UserModel.factory();
    let dbUser = await UserModel.latest() as UserModel;
    assertEquals(dbUser.id, user2.id);
    const user3 = await UserModel.factory();
    dbUser = await UserModel.latest() as UserModel;
    assertEquals(dbUser.id, user3.id);
  });
});

Deno.test("first()", async (t) => {
  await test(t, "Grabs the first of a model", async () => {
    // TODO :: Enable when we can clean the db
    // const user1 = await UserModel.factory()
    // await UserModel.factory()
    // let dbUser = await UserModel.first() as UserModel
    // assertEquals(dbUser.id, user1.id)
    // await UserModel.factory()
    // dbUser = await UserModel.latest() as UserModel
    // assertEquals(dbUser.id, user1.id)
  });
});

Deno.test("withRelations()", async (t) => {
  await test(t, "Adds relations to the model", async () => {
    const user1 = await UserModel.factory();
    assertEquals(await user1.withRelations(), {
      ...user1,
    });
    const article1 = await ArticleModel.factory({
      user_id: user1.id,
    });
    assertEquals(await user1.withRelations("articles"), {
      ...user1,
      articles: [
        article1,
      ],
    });
  });
});
