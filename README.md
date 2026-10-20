# Database-Testing

Playwright + TypeScript automation that validates five tables in an IBM DB2 database.

The tables themselves live in the database (schema `QA`, database `TESTDB`), not in this
repository. The repository holds the connection utility and the tests.

| Table         | Columns                                                                        | Rows |
| ------------- | ------------------------------------------------------------------------------ | ---- |
| `EMPLOYEES`   | EMP_ID, FIRST_NAME, LAST_NAME, EMAIL, DEPARTMENT, SALARY, HIRE_DATE            | 6    |
| `PRODUCTS`    | PRODUCT_ID, SKU, NAME, CATEGORY, PRICE, STOCK_QTY, IS_ACTIVE                   | 5    |
| `CUSTOMERS`   | CUSTOMER_ID, FULL_NAME, CITY, COUNTRY, PHONE, LOYALTY_TIER                     | 4    |
| `ORDERS`      | ORDER_ID, CUSTOMER_ID, PRODUCT_ID, QUANTITY, ORDER_DATE, STATUS, TOTAL_AMOUNT  | 5    |
| `DEPARTMENTS` | DEPT_ID, DEPT_NAME, LOCATION, BUDGET, HEADCOUNT                                | 5    |

## Layout

```
src/config/dbConfig.ts      DB2 connection settings, read from .env
src/utils/dbUtil.ts         DbUtil: connect/close, query, columns, row counts, JSON export
src/fixtures/db.fixture.ts  Playwright fixture sharing one DB2 connection per worker
tests/db2-tables.spec.ts    TC01–TC05: one validation test per table
tests/db2-json-snapshot.spec.ts
                            TC06: exports every table to test-data/db-snapshots/*.json
                            and validates the values read back from those files
test-data/expected-values.json  Expected row counts and first rows used by TC06
```

## Running

1. Install dependencies: `npm install` (installs `ibm_db`, which downloads the IBM DB2 CLI driver).
2. Copy `.env.example` to `.env` and fill in your DB2 host, port, user and password.
3. Run the tests: `npm test`. The HTML report opens with `npm run report`.

If the `ibm_db` install cannot download the CLI driver (e.g. behind a firewall), point it at an
existing driver: `IBM_DB_HOME=/path/to/clidriver npm rebuild ibm_db`, and add
`/path/to/clidriver/lib` to `LD_LIBRARY_PATH` when running the tests.
