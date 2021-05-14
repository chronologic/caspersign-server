import { Cache } from 'memory-cache';

interface ICache {
  put: (key: string, value: any, ttl?: number) => any;
  get: (key: string) => any;
  keys: () => any[];
}

export function createTimedCache(defaultTtl: number): ICache {
  const cache = new Cache();

  return {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    put: (key: string, value: any, ttl = defaultTtl) => cache.put(key, value, ttl),
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    get: (key: string) => cache.get(key),
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    keys: () => cache.keys(),
  };
}
