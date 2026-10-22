import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { ExecutionResponse } from '../types';

export interface HttpRequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  rejectUnauthorizedSsl?: boolean;
  followRedirects?: boolean;
}

export class HttpClient {
  /**
   * Executes an HTTP or HTTPS request offline and returns structured performance and response metrics.
   */
  public static async send(options: HttpRequestOptions): Promise<Omit<ExecutionResponse, 'testResults' | 'logs'>> {
    const startTime = Date.now();
    const isHttps = options.url.toLowerCase().startsWith('https:');

    const httpAgent = new http.Agent({ keepAlive: false });
    const httpsAgent = new https.Agent({
      keepAlive: false,
      rejectUnauthorized: options.rejectUnauthorizedSsl ?? false
    });

    const config: AxiosRequestConfig = {
      url: options.url,
      method: options.method as any,
      headers: { ...options.headers },
      data: options.body,
      timeout: options.timeoutMs ?? 30000,
      maxRedirects: options.followRedirects ? 5 : 0,
      httpAgent,
      httpsAgent,
      validateStatus: () => true, // Don't throw on 4xx/5xx status codes
      responseType: 'arraybuffer', // Receive raw buffer to accurately calculate size & encoding
      transformResponse: [(data) => data] // Keep raw
    };

    let response: AxiosResponse;
    try {
      response = await axios(config);
    } catch (err: any) {
      const timeMs = Date.now() - startTime;
      const errorMessage = err.message || 'Network request failed';
      return {
        statusCode: 0,
        statusText: `Error: ${errorMessage}`,
        timeMs,
        sizeBytes: 0,
        headers: {},
        body: `Error sending request: ${errorMessage}`,
        contentType: 'text/plain',
        isJson: false,
        cookies: [],
        resolvedRequest: {
          url: options.url,
          method: options.method,
          headers: options.headers,
          body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
        }
      };
    }

    const timeMs = Date.now() - startTime;
    const rawBuffer = Buffer.from(response.data);
    const sizeBytes = rawBuffer.length;
    const bodyString = rawBuffer.toString('utf8');

    const headersRecord: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      if (v !== undefined) {
        headersRecord[k] = v;
      }
    }

    const contentType = (headersRecord['content-type'] as string) || 'text/plain';
    let isJson = false;
    if (contentType.includes('application/json') || bodyString.trim().startsWith('{') || bodyString.trim().startsWith('[')) {
      try {
        JSON.parse(bodyString);
        isJson = true;
      } catch (e) {
        isJson = false;
      }
    }

    // Extract cookies from set-cookie
    const cookies: Array<{ name: string; value: string; domain?: string; path?: string }> = [];
    const setCookie = headersRecord['set-cookie'];
    if (setCookie) {
      const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const rawCookie of cookieArray) {
        const parts = rawCookie.split(';').map(s => s.trim());
        if (parts.length > 0) {
          const [nv] = parts;
          const eqIdx = nv.indexOf('=');
          if (eqIdx > 0) {
            const name = nv.substring(0, eqIdx).trim();
            const value = nv.substring(eqIdx + 1).trim();
            cookies.push({ name, value });
          }
        }
      }
    }

    return {
      statusCode: response.status,
      statusText: response.statusText || `${response.status}`,
      timeMs,
      sizeBytes,
      headers: headersRecord,
      body: bodyString,
      contentType,
      isJson,
      cookies,
      resolvedRequest: {
        url: options.url,
        method: options.method,
        headers: options.headers,
        body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
      }
    };
  }
}
