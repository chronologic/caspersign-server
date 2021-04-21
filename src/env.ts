import dotenv from 'dotenv';

dotenv.config();

export const LOG_LEVEL = (process.env.LOG_LEVEL as string) || 'info';

export const PORT = Number(process.env.PORT) || 1337;

export const DATABASE_URL = process.env.DATABASE_URL as string;
export const DB_SYNC = process.env.DB_SYNC === 'true';

export const PROD_BUILD = __filename.endsWith('.js');

export const HS_TEST_MODE = process.env.HS_TEST_MODE === 'true';
export const HS_CLIENT_ID = process.env.HS_CLIENT_ID as string;
export const HS_API_KEY = process.env.HS_API_KEY as string;
export const HS_OAUTH_SECRET = process.env.HS_OAUTH_SECRET as string;