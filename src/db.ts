/* eslint-disable @typescript-eslint/unbound-method */
import redis, { RedisClient } from 'redis';
import { promisify } from 'util';
import debug from 'debug';

const d = debug('reaper:db');

const PREFIX = process.env.REDIS_PREFIX ?? 'reaper';
const key = (id: string) => `${PREFIX}:watermark:${id}`;

class MyRedisClient {
  private _client: RedisClient | undefined;

  // singleton
  private get client() {
    if (this._client === undefined) {
      this._client = redis.createClient({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
      });
    }

    // return a promisified subset of Redis API
    return {
      get: promisify(this._client.get).bind(this._client),
      set: promisify(this._client.set).bind(this._client),
      quit: promisify(this._client.quit).bind(this._client),
    };
  }

  async getWatermark(id: string): Promise<number | undefined> {
    const val = await this.client.get(key(id));
    const timestamp = val !== null ? parseInt(val, 10) : undefined;
    d(`get watermark ${id} ${timestamp !== undefined ? timestamp : '<none>'}`);
    return timestamp;
  }
  
  async updateWatermark(
    id: string,
    timestamp: number
  ): Promise<void> {
    d(`set watermark ${id} ${timestamp}`);
    await this.client.set(key(id), `${timestamp}`);
  }
  
  async disconnect(): Promise<void> {
    await this.client.quit();
    return;
  }
}

export default new MyRedisClient();