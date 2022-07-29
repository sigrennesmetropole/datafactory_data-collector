import got from 'got';
import { Url } from 'url';
import { IOptions } from '../lib';

export interface IHttpResponse {
  type: 'http';
  time: number;
  code: number;
  status?: string;
  payload: Buffer;
  fileName?: string;
}

async function* httpDownload(
  url: Url,
  opts: IOptions
): AsyncGenerator<IHttpResponse, void, IHttpResponse> {
  const res = await got(url.href, {
    timeout: opts.timeout,
    followRedirect: true,
    retry: 0,
  });
  yield {
    type: 'http',
    time: Date.now(),
    code: res.statusCode,
    status: res.statusMessage,
    payload: res.rawBody,
  };
}
export default httpDownload;
