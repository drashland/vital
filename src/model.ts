import { queryRaw } from "./query.ts";
import { QueryBuilder } from "./query_builder.ts";
import type { Where } from "./types.ts";

/**
 * A base class to provide helper methods to querying the database.
 *
 * You can define a class like so:
 * ```js
 * interface UserEntity {
 *   id: number;
 *   name: string;
 *   nicknames: string[];
 *   is_admin: boolean;
 *   config: { google_uri?: string };
 *   customClassProperty: string;
 *   company: Company | null;
 * }
 * class User extends Model {
 *   public tablename = "users";
 *
 *   public id = 0;
 *
 *   public name = "";
 *
 *   public nicknames: string[] = []; // As postgres supports arrays: `nicknames text[] NOT NULL`
 *
 *   public is_admin = false; // As postgres supports booleans: `is_admin boolean NOT NULL`
 *
 *   public config: {
 *     google_uri?: string
 *   } = {}; // As postgres supports objects: `config json NOT NULL`
 *
 *   public company_id = 0;
 *
 *   public created_at = "";
 *
 *   public updated_at = "";
 *
 *   public customClassProperty = "hello world"; // Excluded when saving/updating
 *
 *   public async getSomeData() {
 *     return await doSomething();
 *   }
 *
 *   public async company(): Promise<Company | null> {
 *     return await Company.where([
 *       ['id', this.company_id]
 *     ]).first();
 *   }
 *
 *   public async factoryDefaults(params: Partial<UserEntity> = {}) {
 *     return {
 *       company_id: params.company_id ?? (await Company.factory()).id,
 *       name: params.name ?? "Some name",
 *       // ...,
 *     }
 *   }
 * }
 * let user = await User.factory() // User { ... }
 * console.log(user.id); // 1
 * console.log(await user.company()); // Company { ... }
 * user = await User.where('id', user.id).first();
 * console.log(user.id); // 1
 * console.log(user.name) // "Some name"
 * const user2 = await User.factory({
 *   company_id: (await user.company()).id,
 *   name: "Hello",
 * });
 * console.log(user2.id); // 2
 * console.log(user2.name); // "Hello"
 * console.log((await user2.company()).id); // 1
 * user2.name = "World";
 * await user2.save();
 * console.log(user2.name); // "World";
 * ```
 */
export abstract class BaseModel {
  [k: string]: unknown

  protected abstract tablename: string;

  protected abstract factoryDefaults<T>(
    params: { [P in keyof T]?: T[P] | undefined },
  ): Promise<Record<string, unknown>> | Record<string, unknown>;

  public abstract id: (number | string);

  private async getChildFieldNames(
    omit: {
      id?: boolean;
      timestamps?: boolean;
    } = {},
  ): Promise<Array<string>> {
    const rows = await queryRaw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${this.tablename}'`,
    ) as Array<{
      column_name: string;
    }>;
    let fields = rows.map((row) => row.column_name);
    if (omit.id) {
      fields = fields.filter((field) => field !== "id");
    }
    if (omit.timestamps) {
      fields = fields.filter((field) =>
        ["created_at", "updated_at"].includes(field) === false
      );
    }
    return fields;
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PUBLIC ////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Specficially for when wanting to access relations.
   *
   * Say you want to attach articles to the user. Problem with this is,
   * articles is a method on the class, so it cant also be a property.
   *
   * @example
   * ```js
   * interface EntityWithRelations extends UserEntity {
   *   articles: ArticleModel[]
   * }
   * interface UserEntity {
   *   id: number,
   *   name: string,
   * }
   * class User extends Model {
   *   public async articles() {
   *     return await Article.where(...).first()
   *   }
   * }
   * const user = await UserModel.factory()
   * const entity = await user.withRelations<EntityWithRelations>('articles');
   * console.log(entity); // { id: 1, name: '...', articles: [ ... ] }
   * ```
   *
   * @returns The class as an entity, plus evaluating any relation methods on the class that are passed in
   */
  public async withRelations<Entity>(...relations: string[]): Promise<Entity> {
    const relationData: Record<string, unknown> = {};
    for (const relation of relations) {
      if (typeof this[relation] !== "function") {
        throw new Error(
          `The relation "${relation}" doesn't exist in "${this.constructor.name}`,
        );
      }
      relationData[relation] =
        await (this[relation] as (() => Promise<unknown>))();
    }
    return {
      ...this,
      ...relationData,
    } as Entity;
  }

  /**
   * Save or update the model to the database.
   *
   * If the model exists (eg the `id` property is set), this will
   * update the model, using the values of the field names on the class,
   * and exclude updating the `id`, `created_at` and `updated_at` fields
   *
   * If the model doesn't exist (eg no id), this will insert a new row
   *
   * Once all done, this will then update the class properties with the values inserted, and auto fields
   * such as assigning the new `created_at` value (if your table uses auto timestamps for example)
   *
   * You can also override this class if you needed to perform actions before or after saving:
   * ```js
   * public async save() {
   *   // do somthing before saving...
   *   // ...
   *   await super.save();
   *   // do something after
   *   // ...
   * }
   * ```
   */
  public async save(): Promise<void> {
    const fields = await this.getChildFieldNames({
      id: true,
      timestamps: true,
    }); // wont include timestamps and id
    if (this.id) {
      // update
      let query = `UPDATE ${this.tablename} SET `;
      query += fields.map((name, i) => `${name} = $${i + 1}`).join(", ");
      query += ` WHERE id = $${fields.length + 1}`;
      const rows = await queryRaw(
        query,
        [...fields.map((name) => this[name]), this.id],
      );
      Object.assign(this, rows[0]);
      return;
    }
    let query = `INSERT INTO ${this.tablename} (`;
    query += fields.join(", ");
    query += ` ) VALUES (`;
    query += fields.map((_name, i) => `$${i + 1}`)
      .join(", ");
    query += `) RETURNING *`;
    const result = await queryRaw(
      query,
      fields.map((name) => this[name]),
    );
    Object.assign(this, result[0]);
  }

  /**
   * Delete the model from the database using the `id`.
   * Will not modify the models properties
   *
   * You can extend this if you need to something before or after deleting:
   * ```js
   * public async delete() {
   *   doSomethingBeforeDeleting();
   *   await super.delete();
   *   doSomethingElseNowRowHasBeenDeleted();
   *   console.log(await this.exists()); // false
   * }
   * ```
   *
   * If the table has foreign constraints and you wish to delete those
   * along with this row, for example you have `users`, and `comments`,
   * and `comments` as a foreign key `user_id`, then be sure to add
   * `user_id ... REFERENCES users ON DELETE CASCASE`
   */
  public async delete(): Promise<void> {
    await queryRaw(
      `DELETE FROM ${this.tablename} WHERE id = $1`,
      [this.id],
    );
  }

  /**
   * Check if this model exists in the database via the `id`
   *
   * @returns If the model/row exists
   */
  public async exists(): Promise<boolean> {
    // Fastest way to query if row exists
    const rows = await queryRaw(
      `SELECT EXISTS(SELECT 1 FROM ${this.tablename} WHERE id = $1)`,
      [this.id],
    ) as [
      {
        exists: boolean;
      },
    ];
    return rows[0].exists;
  }

  /**
   * Refresh the model properties by fetching directly from the database.
   * If the row in the database via the id does not exist, this method
   * will simply return. An `exists()` call can aid in testing.
   *
   * @example
   * ```js
   * const user = await UserModel.factory(); // name = "John"
   * await fetch("/users/" + user.id + "/update", {
   *   method: "POST",
   *   body: JSON.stringify({
   *     name: "Jane"
   *   })
   * })
   * await user.refresh()
   * console.log(user.name) // "Jane"
   * ```
   */
  public async refresh(): Promise<void> {
    const query = `SELECT * FROM ${this.tablename} WHERE id = ${this.id}`;
    const rows = await queryRaw(query);
    if (!rows[0]) {
      return;
    }
    Object.assign(this, rows[0]);
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - STATIC ////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Retrieve all records from the table
   *
   * @example
   * ```js
   * const users = await UserModel.all();
   * ```
   *
   * @returns An array of models (or an empty array if no records)
   */
  public static async all<Model extends BaseModel>(
    this: new () => Model,
  ): Promise<Model[]> {
    const query = `SELECT * FROM ${(new this()).tablename}`;
    const rows = await queryRaw(query);
    const models: Model[] = [];
    for (const row of rows) {
      const model = Object.assign(new this(), row);
      models.push(model);
    }
    return models;
  }

  public static async count<Model extends BaseModel>(
    this: new () => Model,
  ): Promise<number> {
    const result = await queryRaw(
      `SELECT COUNT(id)::INTEGER as count from ${(new this()).tablename}`,
    );
    return result[0].count as number;
  }

  public static where<Model extends BaseModel>(
    column: string,
    value: unknown,
  ): QueryBuilder<Model>;
  public static where<Model extends BaseModel>(
    column: string,
    operator: string,
    value: string,
  ): QueryBuilder<Model>;
  /**
   * @example
   * ```js
   * await UserModel.where('id', '=', 1).where('name', 'postgres').first();
   * ```
   *
   * @param data - Conditions
   */
  public static where<Model extends BaseModel>(
    this: new () => Model,
    column: string,
    operatorOrValue: unknown,
    value?: unknown,
  ): QueryBuilder<Model> {
    const where: Where = [[column, operatorOrValue]];
    if (value) {
      where[0].push(value);
    }
    return new QueryBuilder(this, { where });
  }

  /**
   * @example
   * ```js
   * await UserModel.select('id', 'name').all()
   * ```
   * @param fields - List of columns to take. Will ignore any columns not specified
   */
  public static select<Model extends BaseModel>(
    this: new () => Model,
    ...fields: string[]
  ): QueryBuilder<Model> {
    return new QueryBuilder(this, { select: fields });
  }

  /**
   * @example
   * ```js
   * await UserModel.limit(5).all()
   * ```
   *
   * @param amount - Amount to limit
   */
  public static limit<Model extends BaseModel>(
    this: new () => Model,
    amount: number,
  ): QueryBuilder<Model> {
    return new QueryBuilder(this, { limit: amount });
  }

  /**
   * @example
   * ```js
   * await UserModel.whereIn('id', [1, 2, 3]).all()
   * ```
   *
   * @param field - The column name to check
   * @param values - Values the column value can be in
   */
  public static whereIn<Model extends BaseModel>(
    this: new () => Model,
    field: string,
    values: Array<unknown>,
  ): QueryBuilder<Model> {
    return new QueryBuilder(this, {
      whereIn: [
        { field, values },
      ],
    });
  }

  /**
   * @example
   * ```
   * await UserModel.offset(5).all()
   * ```
   *
   * @param amount - The amount to offset (ignore) by
   */
  public static offset<Model extends BaseModel>(
    this: new () => Model,
    amount: number,
  ): QueryBuilder<Model> {
    return new QueryBuilder(this, { offset: amount });
  }

  /**
   * @example
   * ```js
   * await UserModel.ordeBy('id', 'asc').all()
   * ```
   *
   * @param data - The field to order by, and the ordering
   */
  public static orderBy<Model extends BaseModel>(
    this: new () => Model,
    data: [string, "asc" | "desc"],
  ): QueryBuilder<Model> {
    return new QueryBuilder(this, { orderBy: data });
  }

  /**
   * Selects the first row found. If constraints have been set,
   * it will also use those.
   *
   * @returns The row cast to a Model if found, else null
   */
  public static async first<Model extends BaseModel>(
    this: new () => Model,
  ): Promise<Model | null> {
    const model = new this();
    const tablename = model.tablename;
    const query = `SELECT * FROM ${tablename} LIMIT 1`;
    const rows = await queryRaw(query);
    if (!rows.length) {
      return null;
    }
    Object.assign(model, rows[0]);
    return model;
  }

  /**
   * Finds the latest row
   *
   * @returns The row cast to a Modle if found, else null
   */
  public static async latest<Model extends BaseModel>(
    this: new () => Model,
  ): Promise<Model | null> {
    const model = new this();
    const query = `SELECT * FROM ${model.tablename} ORDER BY id DESC LIMIT 1`;
    const rows = await queryRaw(query);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return Object.assign(model, row);
  }

  /**
   * Create a factory
   *
   * Inserts a new record into the database and returns it as a model
   *
   * @example
   * ```js
   * class User extends Model {
   *   static tablename = "users";
   *
   *   // Default data to insert into database
   *   protected factoryDefaults = {
   *     username: "john"
   *   }
   * }
   * const user: User = await User.factory()
   * ```
   *
   * @param params - To set any fields when creating the row
   *
   * @returns An instance of the parent model
   */
  public static async factory<Model extends BaseModel, Entity>(
    this: new () => Model,
    params: Record<string, unknown> = {},
  ): Promise<Model> {
    const model = new this();
    const defaults = await model.factoryDefaults(params);
    Object.keys(params).forEach((key) => {
      defaults[key] = params[key];
    });
    let query = `INSERT INTO ${model.tablename} (`;
    query += Object.keys(defaults).join(", ");
    query += `) VALUES (`;
    query += Object.keys(defaults).map((_k, i) => `$${i + 1}`).join(", ");
    query += `) RETURNING *`;
    const result = await queryRaw(
      query,
      Object.values(defaults),
    );
    Object.assign(model, result[0]);
    return model;
  }
}
