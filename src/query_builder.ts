import { queryRaw } from "./query.ts";
import { BaseModel } from "./model.ts";
import type { Where, WhereIn } from "./types.ts";

interface QueryData {
  where?: Where;
  whereIn?: WhereIn;
  select?: string[];
  limit?: number;
  offset?: number;
  orderBy?: [string, "asc" | "desc"] | [string];
  count?: boolean;
}

export class QueryBuilder<Model extends BaseModel> {
  #where: Where = [];

  #whereIn: WhereIn = [];

  #last_prepared_arg_number = 0;

  #select: string[] = ["*"];

  #limit = 0;

  #offset = 0;

  #orderBy: [string, "asc" | "desc"] | [string] | null = null;

  #tablename: string;

  #model: new () => Model;

  constructor(model: new () => Model, queryData: QueryData) {
    this.#tablename = Reflect.get(new model(), "tablename");
    this.#model = model;
    if (queryData.select) this.#select = queryData.select;
    if (queryData.where) this.#where = queryData.where;
    if (queryData.whereIn) this.#whereIn = queryData.whereIn;
    if (queryData.limit) this.#limit = queryData.limit;
    if (queryData.offset) this.#offset = queryData.offset;
    if (queryData.orderBy) this.#orderBy = queryData.orderBy;
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PRIVATE ///////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Constracts the WHERE section of a query, and returns it and the params to use
   *
   * @example
   * ```js
   * constractWhereQuery([
   *   ['id', 2]
   * ]) // { query: " WHERE id = $1", params: [2] }
   * ```
   *
   * @param where The where fields
   *
   * @returns The query and params
   */
  private constructWhereQuery(where: Where): {
    whereQuery: string;
    whereArgs: Array<string | number>;
  } {
    // Where
    const whereArgs: Array<string | number> = [];
    let whereQuery = where.map((w) => { // where = [ ["id", 1], ["last_updated", '<', now()] ]
      whereArgs.push(w.at(-1) as string);
      const lastPreparedArgNumber = ++this.#last_prepared_arg_number;
      w[w.length - 1] = `$${lastPreparedArgNumber}`;
      if (w.length === 2) {
        return w.join(" = "); // "id = ?"
      }
      return w.join(" "); // "last_updated < ?"
    }).join(" AND "); // "id = ? and last_updated = ?"
    whereQuery = ` WHERE ` + whereQuery + " ";
    return {
      whereQuery,
      whereArgs,
    };
  }

  /**
   * Constracts the WHERE IN section of a query, and returns it and the params to use
   *
   * @example
   * ```js
   * constructWhereInQuery(['id', [1, 2, 3]]) // { query: " WHERE id IN ($1, $2, $3)", params: [1, 2, 3] }
   * ```
   *
   * @param whereIn The where fields
   *
   * @returns The query and params
   */
  private constructWhereInQuery(whereIn: WhereIn): {
    whereInQuery: string;
    whereInArgs: Array<unknown>;
  } {
    const whereInArgs: Array<unknown> = [];
    // Wherein
    let whereInQuery = " ";
    whereIn.forEach((data, i) => {
      if (i === 0) {
        whereInQuery += `WHERE `;
      } else {
        whereInQuery += ` AND `;
      }
      const { field, values } = data;
      whereInQuery += `${field} IN (`;
      const whereInPreparedParams = values.map((w) => {
        whereInArgs.push(w);
        const lastPreparedArgNumber = ++this.#last_prepared_arg_number;
        return `$${lastPreparedArgNumber}`;
      });
      whereInQuery += whereInPreparedParams.join(", ") + ")";
    });
    return {
      whereInQuery,
      whereInArgs,
    };
  }

  private constructFullSelectQuery() {
    const args: Array<unknown> = [];

    // Select
    let query = `SELECT ` + this.#select.join(", ") +
      ` FROM ${this.#tablename}`;

    if (this.#where.length) {
      const { whereQuery, whereArgs } = this.constructWhereQuery(
        this.#where,
      );
      query += whereQuery;
      whereArgs.map((arg) => args.push(arg));
    }

    if (this.#whereIn) {
      const { whereInArgs, whereInQuery } = this.constructWhereInQuery(
        this.#whereIn,
      );
      query += whereInQuery;
      whereInArgs.map((arg) => args.push(arg));
    }

    if (this.#offset) {
      query += ` OFFSET ${this.#offset}`;
    }

    if (this.#orderBy) {
      query += ` ORDER BY ${this.#orderBy[0]}`;
      if (this.#orderBy.length === 2) {
        query += ` ${this.#orderBy[1].toUpperCase()}`;
      }
    }

    if (this.#limit) {
      query += ` LIMIT ${this.#limit}`;
    }

    return { query, args };
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PUBLIC ////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  public async count(): Promise<number> {
    this.#select = ["COUNT(id)::INTEGER as count"];
    const { query, args } = this.constructFullSelectQuery();

    const result = await queryRaw(query, args);
    return result[0].count as number;
  }

  /**
   * Mass delete rows
   *
   * @example
   * ```js
   * const deleteCount = await UserModel.where('email', 'like', '%@hotmail%').delete();
   */
  public async delete(): Promise<void> {
    const tablename = this.#tablename;
    let query = `DELETE FROM ${tablename}`;
    const args: unknown[] = [];

    if (this.#where.length) {
      const { whereQuery, whereArgs } = this.constructWhereQuery(
        this.#where,
      );
      query += whereQuery;
      whereArgs.map((arg) => args.push(arg));
    }

    if (this.#whereIn) {
      const { whereInArgs, whereInQuery } = this.constructWhereInQuery(
        this.#whereIn,
      );
      query += whereInQuery;
      whereInArgs.map((arg) => args.push(arg));
    }

    console.log(this.#whereIn, query, args);

    await queryRaw(query, args);
  }

  /**
   * Mass update rows
   *
   * @example
   * ```js
   * const updatedModels = await UserModel.where('email', 'like', '%@hotmail%').update({
   *   uses_hotmail: true
   * });
   *
   * @param newData
   */
  public async update(newData: Record<string, unknown>): Promise<Model[]> {
    const tablename = this.#tablename;
    let query = `UPDATE ${tablename} SET `;

    const args: unknown[] = [];
    query += Object.keys(newData).map((field) => {
      args.push(newData[field]);
      const lastPreparedArgNumber = ++this.#last_prepared_arg_number;
      return `${field} = $${lastPreparedArgNumber}`;
    }).join(", ");

    if (this.#where.length) {
      const { whereQuery, whereArgs } = this.constructWhereQuery(
        this.#where,
      );
      query += whereQuery;
      whereArgs.map((arg) => args.push(arg));
    }

    if (this.#whereIn.length) {
      const { whereInQuery, whereInArgs } = this.constructWhereInQuery(
        this.#whereIn,
      );
      query += whereInQuery;
      whereInArgs.map((arg) => args.push(arg));
    }

    query += " RETURNING *";

    const rows = await queryRaw(query, args);
    const models: Model[] = [];
    for (const row of rows) {
      models.push(Object.assign(new this.#model(), row));
    }
    return models;
  }

  /**
   * Find the latest entry in the database
   *
   * @example
   * ```js
   * await UserModel.where([
   *     ['is_admin', true],
   * ]).latest(); // UserModel { ... }
   * ```
   *
   * @returns The record converted to the model if found, else null
   */
  public async latest(): Promise<Model | null> {
    const model = new this.#model();

    this.#orderBy = ["id", "desc"];
    this.#limit = 1;
    const { query, args } = this.constructFullSelectQuery();

    // Execute
    const rows = await queryRaw(query, args);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return Object.assign(model, row);
  }

  /**
   * Find a single entry in the database
   *
   * @example
   * ```js
   * await UserModel.where([
   *     ['id', 2],
   *     ['created_at', '>', new Date()]
   * ]).first(); // UserModel { ... }
   * ```
   *
   * @returns The record converted to the model if found, else null
   */
  public async first(): Promise<Model | null> {
    const model = new this.#model();
    this.#limit = 1;
    const { query, args } = this.constructFullSelectQuery();

    // Execute
    const rows = await queryRaw(query, args);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return Object.assign(model, row);
  }

  /**
   * Find a single entry in the database
   *
   * @example
   * ```js
   * await UserModel.where([
   *     ['id', 2],
   *     ['created_at', '>', new Date()]
   * ]).all() // [ UserModel { ... }, ... ]
   * ```
   *
   * @returns The record converted to the model if found, else null
   */
  public async all(): Promise<Model[] | []> {
    const { query, args } = this.constructFullSelectQuery();

    // Execute
    const rows = await queryRaw(query, args);
    const models: Model[] = [];
    for (const row of rows) {
      models.push(Object.assign(new this.#model(), row));
    }
    return models;
  }

  public where(column: string, value: unknown): QueryBuilder<Model>;
  public where(
    column: string,
    operator: string,
    value: unknown,
  ): QueryBuilder<Model>;
  /**
   * @example
   * ```js
   * await UserModel.where('id', 1).where('name', 'like' '%postgres%').first();
   * ```
   *
   * @param data - Conditions
   */
  public where(
    column: string,
    operatorOrValue: string,
    value: unknown = null,
  ): QueryBuilder<Model> {
    if (value !== null) {
      this.#where.push([column, operatorOrValue, value]);
    } else {
      this.#where.push([column, operatorOrValue]);
    }
    return this;
  }

  /**
   * @example
   * ```js
   * await UserModel.select('id', 'name').all()
   * ```
   * @param fields - List of columns to take. Will ignore any columns not specified
   */
  public select(
    ...fields: string[]
  ): QueryBuilder<Model> {
    this.#select = fields;
    return this;
  }

  /**
   * @example
   * ```js
   * await UserModel.limit(5).all()
   * ```
   *
   * @param amount - Amount to limit
   */
  public limit(
    amount: number,
  ): QueryBuilder<Model> {
    this.#limit = amount;
    return this;
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
  public whereIn(
    field: string,
    values: Array<string | number>,
  ): QueryBuilder<Model> {
    this.#whereIn.push({
      field,
      values,
    });
    return this;
  }

  /**
   * @example
   * ```
   * await UserModel.offset(5).all()
   * ```
   *
   * @param amount - The amount to offset (ignore) by
   */
  public offset(
    amount: number,
  ): QueryBuilder<Model> {
    this.#offset = amount;
    return this;
  }

  /**
   * @example
   * ```js
   * await UserModel.ordeBy('id', 'asc').all()
   * ```
   *
   * @param data - The field to order by, and the ordering
   */
  public orderBy(
    data: [string, "asc" | "desc"],
  ): QueryBuilder<Model> {
    this.#orderBy = data;
    return this;
  }
}
