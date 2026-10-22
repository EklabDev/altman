import * as vm from 'vm';
import * as jsrsasign from 'jsrsasign';
import * as CryptoJS from 'crypto-js';
import { expect } from 'chai';
import { ExecutionLog, TestResult } from '../types';

export interface ScriptExecutionResult {
  logs: ExecutionLog[];
  testResults: TestResult[];
  mutatedEnvironment: Record<string, any>;
  mutatedCollectionVars: Record<string, any>;
  mutatedLocalVars: Record<string, any>;
  error?: string;
}

export class ScriptSandbox {
  /**
   * Executes a pre-request or test script in an isolated VM context.
   */
  public static runScript(options: {
    scriptContent: string;
    stage: 'prerequest' | 'test';
    environmentVars: Record<string, any>;
    collectionVars: Record<string, any>;
    localVars: Record<string, any>;
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    };
    response?: {
      code: number;
      status: string;
      headers: Record<string, string | string[]>;
      body: string;
      responseTime: number;
    };
  }): ScriptExecutionResult {
    const logs: ExecutionLog[] = [];
    const testResults: TestResult[] = [];

    const envCopy = { ...options.environmentVars };
    const collCopy = { ...options.collectionVars };
    const localCopy = { ...options.localVars };

    const captureLog = (level: 'log' | 'info' | 'warn' | 'error', args: any[]) => {
      const formatted = args
        .map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
        .join(' ');
      logs.push({
        level,
        message: formatted,
        timestamp: Date.now()
      });
    };

    // Build Postman-compatible pm object
    const pm: any = {
      environment: {
        get: (key: string) => envCopy[key],
        set: (key: string, value: any) => {
          envCopy[key] = value;
        },
        unset: (key: string) => {
          delete envCopy[key];
        },
        has: (key: string) => Object.prototype.hasOwnProperty.call(envCopy, key),
        toObject: () => ({ ...envCopy })
      },
      collectionVariables: {
        get: (key: string) => collCopy[key],
        set: (key: string, value: any) => {
          collCopy[key] = value;
        },
        has: (key: string) => Object.prototype.hasOwnProperty.call(collCopy, key),
        toObject: () => ({ ...collCopy })
      },
      variables: {
        get: (key: string) => {
          if (Object.prototype.hasOwnProperty.call(localCopy, key)) return localCopy[key];
          if (Object.prototype.hasOwnProperty.call(envCopy, key)) return envCopy[key];
          if (Object.prototype.hasOwnProperty.call(collCopy, key)) return collCopy[key];
          return undefined;
        },
        set: (key: string, value: any) => {
          localCopy[key] = value;
        }
      },
      expect: expect,
      test: (name: string, fn: () => void) => {
        try {
          fn();
          testResults.push({ name, passed: true });
        } catch (err: any) {
          testResults.push({
            name,
            passed: false,
            error: err.message || String(err)
          });
        }
      }
    };

    if (options.request) {
      pm.request = {
        url: options.request.url,
        method: options.request.method,
        headers: {
          get: (name: string) => {
            const lc = name.toLowerCase();
            const foundKey = Object.keys(options.request!.headers).find(k => k.toLowerCase() === lc);
            return foundKey ? options.request!.headers[foundKey] : undefined;
          },
          add: (item: { key: string; value: string }) => {
            options.request!.headers[item.key] = item.value;
          },
          upsert: (item: { key: string; value: string }) => {
            options.request!.headers[item.key] = item.value;
          },
          remove: (key: string) => {
            const lc = key.toLowerCase();
            for (const k of Object.keys(options.request!.headers)) {
              if (k.toLowerCase() === lc) {
                delete options.request!.headers[k];
              }
            }
          }
        },
        body: options.request.body
      };
    }

    if (options.response) {
      pm.response = {
        code: options.response.code,
        status: options.response.status,
        responseTime: options.response.responseTime,
        headers: {
          get: (name: string) => {
            const lc = name.toLowerCase();
            const foundKey = Object.keys(options.response!.headers).find(k => k.toLowerCase() === lc);
            return foundKey ? options.response!.headers[foundKey] : undefined;
          }
        },
        text: () => options.response!.body,
        json: () => {
          try {
            return JSON.parse(options.response!.body);
          } catch (e) {
            throw new Error('Response body is not valid JSON');
          }
        }
      };
    }

    // Sandbox context with jsrsasign, CryptoJS, and pm object
    const sandboxContext = {
      pm,
      postman: pm,
      console: {
        log: (...args: any[]) => captureLog('log', args),
        info: (...args: any[]) => captureLog('info', args),
        warn: (...args: any[]) => captureLog('warn', args),
        error: (...args: any[]) => captureLog('error', args)
      },
      jsrsasign,
      KJUR: (jsrsasign as any).KJUR,
      KEYUTIL: (jsrsasign as any).KEYUTIL,
      hextob64: (jsrsasign as any).hextob64,
      b64tohex: (jsrsasign as any).b64tohex,
      hextorstr: (jsrsasign as any).hextorstr,
      rstrtohex: (jsrsasign as any).rstrtohex,
      CryptoJS,
      expect,
      Buffer,
      btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
      atob: (b64: string) => Buffer.from(b64, 'base64').toString('binary'),
      setTimeout: () => {},
      clearTimeout: () => {},
      require: (modName: string) => {
        if (modName === 'jsrsasign') return jsrsasign;
        if (modName === 'crypto-js') return CryptoJS;
        if (modName === 'chai') return { expect };
        throw new Error(`Module '${modName}' is not available in Altman offline sandbox.`);
      }
    };

    try {
      const vmContext = vm.createContext(sandboxContext);
      const script = new vm.Script(options.scriptContent, {
        filename: `${options.stage}-script.js`
      });
      script.runInContext(vmContext, { timeout: 5000 });

      return {
        logs,
        testResults,
        mutatedEnvironment: envCopy,
        mutatedCollectionVars: collCopy,
        mutatedLocalVars: localCopy
      };
    } catch (err: any) {
      logs.push({
        level: 'error',
        message: `Script execution error: ${err.message}`,
        timestamp: Date.now()
      });
      return {
        logs,
        testResults,
        mutatedEnvironment: envCopy,
        mutatedCollectionVars: collCopy,
        mutatedLocalVars: localCopy,
        error: err.message
      };
    }
  }
}
