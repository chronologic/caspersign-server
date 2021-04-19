import '../env';
import { createConnection } from '../db';
import './services/hellosign';

import logger from '../logger';
import app from './app';

createConnection().then(() => {
  logger.info('Connected to database');
  app.listen(app.get('port'), (): void => {
    logger.info(`🌏 Express server started at http://localhost:${app.get('port')}`);
  });
});
