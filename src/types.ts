export type Where = Array<
  [string, unknown] | [string, string, unknown]
>; // [ ['id', 2], ['created_at', '>', new Date()] ]
export type WhereIn = Array<{
  field: string;
  values: unknown[];
}>;
