import { test, expect } from '../src/fixtures/db.fixture';

test.describe('IBM DB2 table validation', () => {
  test('TC01 - EMPLOYEES: structure, row count and employee values', async ({ db }) => {
    expect(db.isConnected()).toBe(true);

    const columns = await db.getColumns('EMPLOYEES');
    expect(columns.map((c) => c.name)).toEqual([
      'EMP_ID', 'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'DEPARTMENT', 'SALARY', 'HIRE_DATE',
    ]);
    expect(columns.find((c) => c.name === 'SALARY')).toMatchObject({ type: 'DECIMAL', length: 10, scale: 2 });

    expect(await db.getRowCount('EMPLOYEES')).toBe(6);

    const mei = await db.getRowById('EMPLOYEES', 'EMP_ID', 104);
    expect(mei).toEqual({
      EMP_ID: 104,
      FIRST_NAME: 'Mei',
      LAST_NAME: 'Tanaka',
      EMAIL: 'mei.tanaka@acme.io',
      DEPARTMENT: 'Engineering',
      SALARY: 105250.75,
      HIRE_DATE: '2018-06-23',
    });

    for (const row of await db.getAllRows('EMPLOYEES')) {
      expect(row.EMAIL).toMatch(/^[a-z]+\.[a-z]+@acme\.io$/);
      expect(Number(row.SALARY)).toBeGreaterThan(0);
    }
  });

  test('TC02 - PRODUCTS: prices, stock and active flag are consistent', async ({ db }) => {
    const products = await db.getAllRows('PRODUCTS');
    expect(products).toHaveLength(5);
    expect(products.map((p) => p.SKU)).toEqual([
      'SKU-1001', 'SKU-1002', 'SKU-2001', 'SKU-2002', 'SKU-3001',
    ]);

    for (const p of products) {
      expect(Number(p.PRICE)).toBeGreaterThan(0);
      expect(Number(p.STOCK_QTY)).toBeGreaterThanOrEqual(0);
      // A product without stock must be inactive.
      if (p.STOCK_QTY === 0) expect(p.IS_ACTIVE).toBe(0);
    }

    const [summary] = await db.query<{ CATEGORY: string; ITEMS: number; TOTAL: number }>(
      `SELECT CATEGORY, COUNT(*) AS ITEMS, SUM(PRICE) AS TOTAL
       FROM ${db.schema}.PRODUCTS WHERE CATEGORY = ? GROUP BY CATEGORY`,
      ['Furniture'],
    );
    expect(summary).toEqual({ CATEGORY: 'Furniture', ITEMS: 2, TOTAL: 628.99 });
  });

  test('TC03 - CUSTOMERS: mandatory fields, nullable phone and loyalty tiers', async ({ db }) => {
    const columns = await db.getColumns('CUSTOMERS');
    expect(columns.filter((c) => c.nullable).map((c) => c.name)).toEqual(['PHONE']);

    const customers = await db.getAllRows('CUSTOMERS');
    expect(customers).toHaveLength(4);

    for (const c of customers) {
      expect(c.FULL_NAME).toBeTruthy();
      expect(['GOLD', 'SILVER', 'BRONZE']).toContain(c.LOYALTY_TIER);
    }

    const priya = await db.getRowById('CUSTOMERS', 'CUSTOMER_ID', 5003);
    expect(priya).toMatchObject({ FULL_NAME: 'Priya Nair', CITY: 'Bengaluru', PHONE: null });

    const gold = customers.filter((c) => c.LOYALTY_TIER === 'GOLD').map((c) => c.FULL_NAME);
    expect(gold).toEqual(['Olivia Brown', 'Lucas Martin']);
  });

  test('TC04 - ORDERS: referential integrity and order totals', async ({ db }) => {
    expect(await db.getRowCount('ORDERS')).toBe(5);

    const orphans = await db.query(
      `SELECT O.ORDER_ID FROM ${db.schema}.ORDERS O
       LEFT JOIN ${db.schema}.CUSTOMERS C ON C.CUSTOMER_ID = O.CUSTOMER_ID
       LEFT JOIN ${db.schema}.PRODUCTS  P ON P.PRODUCT_ID  = O.PRODUCT_ID
       WHERE C.CUSTOMER_ID IS NULL OR P.PRODUCT_ID IS NULL`,
    );
    expect(orphans).toEqual([]);

    // Every order total must equal quantity x unit price of the ordered product.
    const mismatches = await db.query(
      `SELECT O.ORDER_ID FROM ${db.schema}.ORDERS O
       JOIN ${db.schema}.PRODUCTS P ON P.PRODUCT_ID = O.PRODUCT_ID
       WHERE O.TOTAL_AMOUNT <> O.QUANTITY * P.PRICE`,
    );
    expect(mismatches).toEqual([]);

    const statuses = (await db.getAllRows('ORDERS')).map((o) => o.STATUS);
    expect(statuses).toEqual(['DELIVERED', 'SHIPPED', 'PENDING', 'CANCELLED', 'DELIVERED']);
  });

  test('TC05 - DEPARTMENTS: unique names and headcount matches EMPLOYEES', async ({ db }) => {
    const departments = await db.getAllRows('DEPARTMENTS');
    expect(departments).toHaveLength(5);

    const names = departments.map((d) => d.DEPT_NAME);
    expect(new Set(names).size).toBe(names.length);

    const actual = await db.query<{ DEPARTMENT: string; CNT: number }>(
      `SELECT DEPARTMENT, COUNT(*) AS CNT FROM ${db.schema}.EMPLOYEES GROUP BY DEPARTMENT`,
    );
    const actualByDept = Object.fromEntries(actual.map((r) => [r.DEPARTMENT, r.CNT]));
    for (const d of departments) {
      expect(actualByDept[d.DEPT_NAME as string], `headcount of ${d.DEPT_NAME}`).toBe(d.HEADCOUNT);
    }

    const [{ TOTAL }] = await db.query<{ TOTAL: number }>(
      `SELECT SUM(BUDGET) AS TOTAL FROM ${db.schema}.DEPARTMENTS`,
    );
    expect(TOTAL).toBe(3100000);
  });
});
