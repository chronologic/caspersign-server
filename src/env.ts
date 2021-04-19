import dotenv from 'dotenv';

dotenv.config();

export const LOG_LEVEL = (process.env.LOG_LEVEL as string) || 'info';

export const DATABASE_URL = process.env.DATABASE_URL as string;
export const DB_SYNC = process.env.DB_SYNC === 'true';

export const PROD_BUILD = __filename.endsWith('.js');
