import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export class UniqueService {
  /* CREATE (generic) */
  async create<T = any>(
    table: string,
    payload: Partial<T>
  ): Promise<T> {
    const { data, error } = await DBconnection
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error(`DB create failed on ${table}`, { error: error.message, code: error.code });
      throw error;
    }
    return data as T;
  }

  /* GET ALL — hard cap of 1000 rows to prevent unbounded memory consumption */
  async getAllData<T = any>(table: string, limit = 1000): Promise<T[]> {
    const { data, error } = await DBconnection
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`DB getAllData failed on ${table}`, { error: error.message, code: error.code });
      throw error;
    }
    return (data ?? []) as T[];
  }

  /* GET ALL — always paginated to prevent unbounded result sets */
  async getData<T = any>(table: string, limit = 100, page = 1): Promise<T[]> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await DBconnection
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logger.error(`DB getAll failed on ${table}`, { error: error.message, code: error.code });
      throw error;
    }
    return data as T[];
  }

  /* GET BY ID */
  async getDataById<T = any>(
    id: any,
    table: string
  ): Promise<T> {
    const { data, error } = await DBconnection
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logger.error(`DB getById failed on ${table}`, { id, error: error.message, code: error.code });
      throw error;
    }

    if (!data) {
      throw new Error("Record not found");
    }

    return data as T;
  }

  /* UPDATE BY ID */
  async updateById<T = any>(
    table: string,
    id: any,
    payload: Partial<T>
  ): Promise<T> {
    const updatePayload = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await DBconnection
      .from(table)
      .update(updatePayload)
      .eq("id", id)
      .select();

    if (error) {
      logger.error(`DB update failed on ${table}`, { id, error: error.message, code: error.code });
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("Record not found");
    }

    return data[0] as T;
  }

  /* DELETE BY ID */
  async deleteData(
    table: string,
    id: any
  ): Promise<{ message: string }> {
    const { data, error } = await DBconnection
      .from(table)
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      logger.error(`DB delete failed on ${table}`, { id, error: error.message, code: error.code });
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("Record not found");
    }

    return { message: "Deleted successfully" };
  }

  async getDataByField<T = any>(
    table: string,
    field: string,
    value: any,
    checkIsActive = false
  ): Promise<T[]> {
    let query = DBconnection
      .from(table)
      .select("*")
      .eq(field, value);

    if (checkIsActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`DB getByField failed on ${table}`, { field, error: error.message, code: error.code });
      throw error;
    }

    return data as T[];
  }

  async getDataByMultipleFields<T = any>(
    table: string,
    conditions: Record<string, string | number | boolean | null>
  ): Promise<T[]> {
    let query = DBconnection.from(table).select("*");

    for (const [key, value] of Object.entries(conditions)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`DB getByMultipleFields failed on ${table}`, { conditions, error: error.message, code: error.code });
      throw error;
    }
    return data as T[];
  }

  /* GET WITH SEARCH + PAGINATION */
  async getDataWithSearch<T = any>(
    table: string,
    searchColumns: string[],
    searchValue?: string,
    limit = 10,
    page = 1,
    extraFilters: Record<string, string | number | boolean | null> = {}
  ): Promise<{ data: T[]; total: number }> {
    let query = this.buildBaseQuery(table, limit, page);

    for (const [key, value] of Object.entries(extraFilters)) {
      query = query.eq(key, value);
    }

    if (searchValue?.trim() && searchColumns.length) {
      const conditions = this.buildSearchConditions(
        searchColumns,
        searchValue.trim()
      );

      if (conditions.length) {
        query = query.or(conditions.join(","));
      }
    }

    return this.executeQuery<T>(query, table);
  }




  async getDataWithPagination<T = any>(
  table: string,
  limit = 10,
  page = 1
): Promise<{ data: T[]; total: number }> {
  const query = this.buildBaseQuery(table, limit, page);

  // ❌ Removed search logic completely

  return this.executeQuery<T>(query, table);
}
  async getDataByFieldPaginated<T = any>(
    table: string,
    field: string,
    value: string | number | boolean | null,
    limit = 10,
    page = 1,
    searchColumns: string[] = [],
    searchValue?: string
  ): Promise<{ data: T[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const baseQuery = DBconnection
      .from(table)
      .select("*", { count: "exact" })
      .eq(field, value)
      .range(from, to);

    if (searchValue?.trim() && searchColumns.length) {
      const conditions = this.buildSearchConditions(searchColumns, searchValue.trim());
      if (conditions.length) {
        baseQuery.or(conditions.join(","));
      }
    }

    return this.executeQuery<T>(baseQuery, table);
  }

  /* =========================
     PRIVATE HELPERS
     ========================= */

  private buildBaseQuery(table: string, limit: number, page: number) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    return DBconnection
      .from(table)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
  }

  private buildSearchConditions(columns: string[], value: string): string[] {
    const isUUIDValue = this.isUUID(value);

    return columns.flatMap(col => {
      const isUUIDCol = this.isUUIDColumn(col);

      if (isUUIDCol) {
        return isUUIDValue ? [`${col}.eq.${value}`] : [];
      }

      return [`${col}.ilike.*${value}*`];
    });
  }

  private async executeQuery<T>(query: any, table: string): Promise<PaginatedResult<T>> {
    const { data, count, error } = await query;
    if (error) {
      logger.warn(`Paginated query warning on ${table}`, { error: error.message });
      return { data: [], total: 0 };
    }
    return { data: data ?? [], total: count ?? 0 };
  }

  private isUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private isUUIDColumn(column: string): boolean {
    return ["user_id", "store_id"].includes(column);
  }

  /* GET MANY BY IDS — batch fetch rows by id array */
  async getDataByIds<T = any>(
    table: string,
    ids: string[],
    selectColumns = '*'
  ): Promise<T[]> {
    if (!ids.length) return [];
    const { data, error } = await DBconnection
      .from(table)
      .select(selectColumns)
      .in('id', ids);

    if (error) {
      logger.error(`DB getDataByIds failed on ${table}`, { error: error.message, code: error.code });
      throw error;
    }
    return (data ?? []) as T[];
  }

}