import bodyParser from 'body-parser';
import compression from 'compression';
import morgan from 'morgan';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import formData from 'express-form-data';
import requestIp from 'request-ip';

import { LOG_LEVEL, PORT } from '../env';
import { ApplicationError } from './errors';
import routes from './routes';

const app = express();

app.set('trust proxy', true);

app.use(cors());
app.use(compression());

app.use(requestIp.mw());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(formData.parse({ autoClean: true }));
app.use(morgan('tiny'));

app.set('port', PORT);

app.use(routes);

app.use((err: ApplicationError, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    error: LOG_LEVEL === 'debug' ? err : undefined,
    message: err.message,
  });
});

export default app;
