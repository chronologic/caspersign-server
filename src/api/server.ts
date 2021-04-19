import './env';
import { createConnection } from 'keeper-db';

import app from './app';
import logger from './logger';

createConnection().then(() => {
  logger.info('Connected to database');
  app.listen(app.get('port'), (): void => {
    logger.info(`🌏 Express server started at http://localhost:${app.get('port')}`);
  });
});
