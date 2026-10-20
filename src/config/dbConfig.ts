import 'dotenv/config';

export interface Db2Config {
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  schema: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const dbConfig: Db2Config = {
  database: process.env.DB2_DATABASE ?? 'TESTDB',
  host: process.env.DB2_HOST ?? 'localhost',
  port: Number(process.env.DB2_PORT ?? 50000),
  user: process.env.DB2_USER ?? 'db2inst1',
  password: required('DB2_PASSWORD'),
  schema: process.env.DB2_SCHEMA ?? 'QA',
};

export function toConnectionString(cfg: Db2Config): string {
  return (
    `DATABASE=${cfg.database};HOSTNAME=${cfg.host};PORT=${cfg.port};` +
    `PROTOCOL=TCPIP;UID=${cfg.user};PWD=${cfg.password};`
  );
}
