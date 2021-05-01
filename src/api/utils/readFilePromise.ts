import fs from 'fs';
import { promisify } from 'util';

export const readFilePromise = promisify(fs.readFile);
