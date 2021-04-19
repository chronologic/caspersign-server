import dotenv from 'dotenv';

dotenv.config();

export const LOG_LEVEL = (process.env.LOG_LEVEL as string) || 'info';

export const PORT = Number(process.env.PORT || 3001);

export const MIN_LOT_SIZE_BTC = Number(process.env.MIN_LOT_SIZE_BTC || 1);
export const MAX_LOT_SIZE_BTC = Number(process.env.MAX_LOT_SIZE_BTC || 1000);
