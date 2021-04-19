import '../env';
import { createConnection } from './createConnection';
import logger from '../logger';

createConnection().then(() => {
  logger.info('DB schema synchronized');
});
