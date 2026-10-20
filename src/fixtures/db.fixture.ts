import { test as base } from '@playwright/test';
import { DbUtil } from '../utils/dbUtil';

/** Provides one DB2 connection per worker, opened before the first test and closed after the last. */
export const test = base.extend<{}, { db: DbUtil }>({
  db: [
    async ({}, use) => {
      const db = new DbUtil();
      await db.connect();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
