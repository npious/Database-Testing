import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../src/fixtures/db.fixture';
import { Row, TABLES } from '../src/utils/dbUtil';

const SNAPSHOT_DIR = path.join(__dirname, '..', 'test-data', 'db-snapshots');
const expected: Record<string, { rowCount: number; firstRow: Row }> = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test-data', 'expected-values.json'), 'utf-8'),
);

test('TC06 - export every DB2 table to JSON and validate the values from the JSON files', async ({ db }) => {
  for (const table of TABLES) {
    await test.step(`${table}: export to JSON`, async () => {
      const file = await db.exportTableToJson(table, SNAPSHOT_DIR);
      expect(fs.existsSync(file)).toBe(true);
    });

    await test.step(`${table}: validate values read back from JSON`, async () => {
      const snapshot = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `${table}.json`), 'utf-8'));

      expect(snapshot.table).toBe(table);
      expect(snapshot.schema).toBe(db.schema);
      expect(snapshot.rows).toHaveLength(expected[table].rowCount);
      expect(snapshot.rows[0]).toEqual(expected[table].firstRow);

      // Every row in the JSON must carry exactly the table's columns.
      const columnNames = snapshot.columns.map((c: { name: string }) => c.name);
      for (const row of snapshot.rows) {
        expect(Object.keys(row)).toEqual(columnNames);
      }

      // The JSON must still mirror the live table.
      expect(snapshot.rows).toEqual(await db.getAllRows(table));
    });
  }
});
