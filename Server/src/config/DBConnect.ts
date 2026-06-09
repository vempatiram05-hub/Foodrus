import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config();

let dbPool: mysql.Pool;

export function initializePool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT || "3307", 10),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "ruchi_xpress",
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
    });
  }
  return dbPool;
}

function parseOrString(orString: string): { sql: string; params: any[] } {
  const conditions: string[] = [];
  let current = "";
  let parenDepth = 0;
  for (let i = 0; i < orString.length; i++) {
    const char = orString[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    
    if (char === ',' && parenDepth === 0) {
      conditions.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    conditions.push(current.trim());
  }

  const sqlParts: string[] = [];
  const params: any[] = [];

  for (const cond of conditions) {
    const parts = cond.split(".");
    if (parts.length < 3) continue;
    const col = parts[0];
    const op = parts[1];
    let val = parts.slice(2).join(".");

    if (op === "eq") {
      if (val === "true") {
        sqlParts.push(`\`${col}\` = ?`);
        params.push(1);
      } else if (val === "false") {
        sqlParts.push(`\`${col}\` = ?`);
        params.push(0);
      } else if (val === "null") {
        sqlParts.push(`\`${col}\` IS NULL`);
      } else {
        sqlParts.push(`\`${col}\` = ?`);
        params.push(val);
      }
    } else if (op === "neq") {
      if (val === "true") {
        sqlParts.push(`\`${col}\` != ?`);
        params.push(1);
      } else if (val === "false") {
        sqlParts.push(`\`${col}\` != ?`);
        params.push(0);
      } else if (val === "null") {
        sqlParts.push(`\`${col}\` IS NOT NULL`);
      } else {
        sqlParts.push(`\`${col}\` != ?`);
        params.push(val);
      }
    } else if (op === "ilike" || op === "like") {
      sqlParts.push(`\`${col}\` LIKE ?`);
      params.push(val);
    } else if (op === "in") {
      if (val.startsWith("(") && val.endsWith(")")) {
        val = val.substring(1, val.length - 1);
      }
      const inVals = val.split(",").map(v => v.trim());
      if (inVals.length > 0) {
        const placeholders = inVals.map(() => "?").join(", ");
        sqlParts.push(`\`${col}\` IN (${placeholders})`);
        params.push(...inVals);
      } else {
        sqlParts.push("FALSE");
      }
    }
  }

  return {
    sql: sqlParts.length > 0 ? `(${sqlParts.join(" OR ")})` : "TRUE",
    params
  };
}

class QueryBuilder<T = any[]> implements PromiseLike<{ data: T; error: any; count: number | null }> {
  private tableName: string;
  private method: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string = "*";
  private countOption?: "exact" | "planned" | "estimated";
  private insertData: any = null;
  private updateData: any = null;
  
  private whereClauses: string[] = [];
  private whereParams: any[] = [];
  
  private orderCol?: string;
  private orderAscending: boolean = true;
  private limitCount?: number;
  private offsetCount?: number;
  
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private isHead: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns?: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): QueryBuilder<T> {
    this.method = "select";
    if (columns) {
      this.selectCols = columns;
    }
    if (options?.count) {
      this.countOption = options.count;
    }
    if (options?.head) {
      this.isHead = true;
    }
    return this;
  }

  insert(data: any): QueryBuilder<T> {
    this.method = "insert";
    this.insertData = data;
    return this;
  }

  update(data: any): QueryBuilder<T> {
    this.method = "update";
    this.updateData = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this.method = "delete";
    return this;
  }

  eq(column: string, value: any): QueryBuilder<T> {
    if (value === null) {
      this.whereClauses.push(`\`${column}\` IS NULL`);
    } else {
      this.whereClauses.push(`\`${column}\` = ?`);
      if (typeof value === "boolean") {
        this.whereParams.push(value ? 1 : 0);
      } else {
        this.whereParams.push(value);
      }
    }
    return this;
  }

  neq(column: string, value: any): QueryBuilder<T> {
    if (value === null) {
      this.whereClauses.push(`\`${column}\` IS NOT NULL`);
    } else {
      this.whereClauses.push(`\`${column}\` != ?`);
      if (typeof value === "boolean") {
        this.whereParams.push(value ? 1 : 0);
      } else {
        this.whereParams.push(value);
      }
    }
    return this;
  }

  in(column: string, values: any[]): QueryBuilder<T> {
    if (!values || values.length === 0) {
      this.whereClauses.push("FALSE");
    } else {
      const placeholders = values.map(() => "?").join(", ");
      this.whereClauses.push(`\`${column}\` IN (${placeholders})`);
      this.whereParams.push(...values);
    }
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    this.whereClauses.push(`\`${column}\` LIKE ?`);
    this.whereParams.push(pattern);
    return this;
  }

  or(orString: string): QueryBuilder<T> {
    const { sql, params } = parseOrString(orString);
    this.whereClauses.push(sql);
    this.whereParams.push(...params);
    return this;
  }

  gte(column: string, value: any): QueryBuilder<T> {
    this.whereClauses.push(`\`${column}\` >= ?`);
    this.whereParams.push(value);
    return this;
  }

  lte(column: string, value: any): QueryBuilder<T> {
    this.whereClauses.push(`\`${column}\` <= ?`);
    this.whereParams.push(value);
    return this;
  }

  gt(column: string, value: any): QueryBuilder<T> {
    this.whereClauses.push(`\`${column}\` > ?`);
    this.whereParams.push(value);
    return this;
  }

  lt(column: string, value: any): QueryBuilder<T> {
    this.whereClauses.push(`\`${column}\` < ?`);
    this.whereParams.push(value);
    return this;
  }

  not(column: string, operator: string, value: any): QueryBuilder<T> {
    if (operator === "is" && value === null) {
      this.whereClauses.push(`\`${column}\` IS NOT NULL`);
    } else if (operator === "eq") {
      this.whereClauses.push(`\`${column}\` != ?`);
      this.whereParams.push(value);
    } else {
      this.whereClauses.push(`NOT (\`${column}\` = ?)`);
      this.whereParams.push(value);
    }
    return this;
  }

  is(column: string, value: any): QueryBuilder<T> {
    if (value === null) {
      this.whereClauses.push(`\`${column}\` IS NULL`);
    } else if (value === true) {
      this.whereClauses.push(`\`${column}\` IS TRUE`);
    } else if (value === false) {
      this.whereClauses.push(`\`${column}\` IS FALSE`);
    } else {
      this.whereClauses.push(`\`${column}\` = ?`);
      this.whereParams.push(value);
    }
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this.limitCount = to - from + 1;
    this.offsetCount = from;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this.orderCol = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  single<TRow = any>(): QueryBuilder<TRow> {
    this.isSingle = true;
    return this as unknown as QueryBuilder<TRow>;
  }

  maybeSingle<TRow = any>(): QueryBuilder<TRow> {
    this.isMaybeSingle = true;
    return this as unknown as QueryBuilder<TRow>;
  }

  head(): QueryBuilder<null> {
    this.isHead = true;
    return this as unknown as QueryBuilder<null>;
  }

  then<TResult1 = { data: T; error: any; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T; error: any; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected) as Promise<TResult1 | TResult2>;
  }

  private async execute(): Promise<any> {
    const pool = initializePool();
    let sql = "";
    const params: any[] = [];
    
    const whereSql = this.whereClauses.length > 0 
      ? ` WHERE ${this.whereClauses.join(" AND ")}` 
      : "";

    let totalCount: number | null = null;

    if (this.method === "select") {
      if (this.countOption === "exact") {
        const countSql = `SELECT COUNT(*) as cnt FROM \`${this.tableName}\`${whereSql}`;
        const [countRows]: any = await pool.query(countSql, this.whereParams);
        totalCount = countRows[0]?.cnt ?? 0;
      }

      if (this.isHead) {
        return { data: null, error: null, count: totalCount };
      }

      let orderSql = "";
      if (this.orderCol) {
        orderSql = ` ORDER BY \`${this.orderCol}\` ${this.orderAscending ? "ASC" : "DESC"}`;
      }

      let limitSql = "";
      if (this.limitCount !== undefined) {
        limitSql = ` LIMIT ${this.limitCount}`;
        if (this.offsetCount !== undefined) {
          limitSql += ` OFFSET ${this.offsetCount}`;
        }
      }

      let columns = "*";
      if (this.selectCols && this.selectCols !== "*") {
        columns = this.selectCols.split(",").map(c => `\`${c.trim()}\``).join(", ");
      }

      sql = `SELECT ${columns} FROM \`${this.tableName}\`${whereSql}${orderSql}${limitSql}`;
      params.push(...this.whereParams);

      const [rows]: any = await pool.query(sql, params);

      if (this.isSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: "No rows found" }, count: totalCount };
        }
        return { data: rows[0], error: null, count: totalCount };
      }

      if (this.isMaybeSingle) {
        if (rows.length === 0) {
          return { data: null, error: null, count: totalCount };
        }
        return { data: rows[0], error: null, count: totalCount };
      }

      return { data: rows, error: null, count: totalCount };

    } else if (this.method === "insert") {
      const isArray = Array.isArray(this.insertData);
      const records = isArray ? this.insertData : [this.insertData];

      const insertedRows: any[] = [];

      for (const record of records) {
        const row = { ...record };
        if (row.id === undefined) {
          row.id = randomUUID();
        }

        const keys = Object.keys(row);
        const placeholders = keys.map(() => "?").join(", ");
        const insertSql = `INSERT INTO \`${this.tableName}\` (${keys.map(k => `\`${k}\``).join(", ")}) VALUES (${placeholders})`;
        
        const insertParams = keys.map(k => {
          const val = row[k];
          if (val !== null && typeof val === "object" && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        await pool.query(insertSql, insertParams);
        insertedRows.push(row);
      }

      const returnedData = isArray ? insertedRows : insertedRows[0];
      return { data: returnedData, error: null };

    } else if (this.method === "update") {
      const keys = Object.keys(this.updateData);
      if (keys.length === 0) {
        return { data: [], error: { message: "No fields to update" } };
      }

      const setSql = keys.map(k => `\`${k}\` = ?`).join(", ");
      const updateParams = keys.map(k => {
        const val = this.updateData[k];
        if (val !== null && typeof val === "object" && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });

      sql = `UPDATE \`${this.tableName}\` SET ${setSql}${whereSql}`;
      params.push(...updateParams, ...this.whereParams);

      await pool.query(sql, params);

      const selectSql = `SELECT * FROM \`${this.tableName}\`${whereSql}`;
      const [updatedRows]: any = await pool.query(selectSql, this.whereParams);

      if (this.isSingle) {
        return { data: updatedRows[0] ?? null, error: null };
      }
      return { data: updatedRows, error: null };

    } else if (this.method === "delete") {
      const selectSql = `SELECT * FROM \`${this.tableName}\`${whereSql}`;
      const [deletedRows]: any = await pool.query(selectSql, this.whereParams);

      sql = `DELETE FROM \`${this.tableName}\`${whereSql}`;
      params.push(...this.whereParams);

      await pool.query(sql, params);

      return { data: deletedRows, error: null };
    }

    return { data: null, error: { message: "Unknown method" } };
  }
}

export const DBconnection = {
  from(tableName: string) {
    return new QueryBuilder(tableName);
  },
  async rpc(fn: string, args: any) {
    const pool = initializePool();
    if (fn === "find_circle_by_location") {
      try {
        const user_long = args.user_long;
        const user_lat = args.user_lat;
        const [rows]: any = await pool.query(
          "SELECT *, ST_Distance_Sphere(point(longitude, latitude), point(?, ?)) as distance FROM circles ORDER BY distance ASC LIMIT 1",
          [user_long, user_lat]
        );
        return { data: rows, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    }
    return { data: null, error: { message: `RPC function ${fn} not implemented` } };
  }
};
