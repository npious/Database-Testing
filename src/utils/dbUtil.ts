import * as fs from 'fs';
import * as path from 'path';
import * as ibmdb from 'ibm_db';
import { Db2Config, dbConfig, toConnectionString } from '../config/dbConfig';

export type Row = Record<string, string | number | null>;

export interface ColumnInfo {
  name: string;
  type: string;
  length: number;
  scale: number;
  nullable: boolean;
}

/** The five tables created in the DB2 database for this suite. */
export const TABLES = ['EMPLOYEES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS', 'DEPARTMENTS'] as const;
export type TableName = (typeof TABLES)[number];

/**
 * Thin wrapper around the ibm_db driver: owns the DB2 connection and exposes
 * the table-level helpers the tests need.
 */
export class DbUtil {
  private db: ibmdb.Database | null = null;

  constructor(private readonly config: Db2Config = dbConfig) {}

  get schema(): string {
    return this.config.schema;
  }

  async connect(): Promise<void> {
    if (this.db) return;
    this.db = await ibmdb.open(toConnectionString(this.config));
  }

  async close(): Promise<void> {
    if (!this.db) return;
    await this.db.close();
    this.db = null;
  }

  isConnected(): boolean {
    return this.db?.connected ?? false;
  }

  async query<T = Row>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('DbUtil is not connected. Call connect() first.');
    }
    return (await this.db.query(sql, params)) as T[];
  }

  /** Names of the tables that exist in the configured schema. */
  async listTables(): Promise<string[]> {
    const rows = await this.query<{ TABNAME: string }>(
      `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABSCHEMA = ? AND TYPE = 'T' ORDER BY TABNAME`,
      [this.schema],
    );
    return rows.map((r) => r.TABNAME);
  }

  async getColumns(table: TableName): Promise<ColumnInfo[]> {
    const rows = await this.query<{
      COLNAME: string;
      TYPENAME: string;
      LENGTH: number;
      SCALE: number;
      NULLS: string;
    }>(
      `SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS FROM SYSCAT.COLUMNS
       WHERE TABSCHEMA = ? AND TABNAME = ? ORDER BY COLNO`,
      [this.schema, table],
    );
    return rows.map((r) => ({
      name: r.COLNAME,
      type: r.TYPENAME.trim(),
      length: r.LENGTH,
      scale: r.SCALE,
      nullable: r.NULLS === 'Y',
    }));
  }

  async getRowCount(table: TableName): Promise<number> {
    const [row] = await this.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM ${this.qualified(table)}`,
    );
    return Number(row.CNT);
  }

  /** All rows of a table, ordered by its first column (the primary key in this suite). */
  async getAllRows(table: TableName): Promise<Row[]> {
    const [firstColumn] = await this.getColumns(table);
    return this.query(`SELECT * FROM ${this.qualified(table)} ORDER BY ${firstColumn.name}`);
  }

  async getRowById(table: TableName, idColumn: string, id: number): Promise<Row | undefined> {
    const rows = await this.query(
      `SELECT * FROM ${this.qualified(table)} WHERE ${idColumn} = ?`,
      [id],
    );
    return rows[0];
  }

  /** Writes every row of the table to `<dir>/<TABLE>.json` and returns the file path. */
  async exportTableToJson(table: TableName, dir: string): Promise<string> {
    const snapshot = {
      schema: this.schema,
      table,
      exportedAt: new Date().toISOString(),
      columns: await this.getColumns(table),
      rows: await this.getAllRows(table),
    };
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${table}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    return file;
  }

  private qualified(table: TableName): string {
    // Table names come from the TABLES allow-list, so interpolation is safe here.
    if (!TABLES.includes(table)) {
      throw new Error(`Unknown table ${table}`);
    }
    return `${this.schema}.${table}`;
  }
}
