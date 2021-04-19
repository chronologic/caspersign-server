/* eslint-disable prefer-template */
/* eslint-disable no-path-concat */
import { ConnectionStringParser } from 'connection-string-parser';
import { ConnectionOptions, createConnection as typeormCreateConnection } from 'typeorm';

import { DB_SYNC, DATABASE_URL, LOG_LEVEL, PROD_BUILD } from '../env';

const parser = new ConnectionStringParser({
  scheme: 'postgres',
} as any);

const parsed = parser.parse(DATABASE_URL);
const { host, port } = parsed.hosts[0];

const params: ConnectionOptions = {
  type: 'postgres',
  host: host || 'localhost',
  port: port || 5432,
  username: parsed.username || 'caspersign',
  password: parsed.password || 'caspersign',
  database: parsed.endpoint || 'caspersign',
  schema: 'cs',
  synchronize: DB_SYNC,
  logging: LOG_LEVEL === 'debug',
  entities: [__dirname + `/entities/**/*.${PROD_BUILD ? 'js' : 'ts'}`],
  migrations: [__dirname + `/migrations/**/*.${PROD_BUILD ? 'js' : 'ts'}`],
  subscribers: [__dirname + `/subscribers/**/*.${PROD_BUILD ? 'js' : 'ts'}`],
  ssl: host !== 'localhost',
};

export async function createConnection() {
  const connection = await typeormCreateConnection(params);
  return connection;
}
