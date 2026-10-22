import { v4 as uuidv4 } from 'uuid';
import { PostmanAuth, PostmanHeader, PostmanItem, PostmanUrl } from '../types';

export interface VariableContext {
  local?: Record<string, any>;
  environment?: Record<string, any>;
  collection?: Record<string, any>;
  global?: Record<string, any>;
}

export class VariableResolver {
  /**
   * Generates dynamic built-in Postman variables like {{$guid}}, {{$timestamp}}, etc.
   */
  public static getDynamicVariable(name: string): string | undefined {
    switch (name) {
      case '$guid':
      case '$randomUUID':
        return uuidv4();
      case '$timestamp':
        return Math.floor(Date.now() / 1000).toString();
      case '$isoTimestamp':
        return new Date().toISOString();
      case '$randomInt':
        return Math.floor(Math.random() * 1000 + 1).toString();
      case '$randomEmail':
        return `user_${Math.floor(Math.random() * 10000)}@example.com`;
      case '$randomAlphaNumeric':
        return Math.random().toString(36).substring(2, 10);
      default:
        return undefined;
    }
  }

  /**
   * Merges variables according to priority:
   * Local > Environment > Collection > Global
   */
  public static mergeVariables(ctx: VariableContext): Record<string, any> {
    return {
      ...(ctx.global || {}),
      ...(ctx.collection || {}),
      ...(ctx.environment || {}),
      ...(ctx.local || {})
    };
  }

  /**
   * Resolves {{var}} within a string template.
   */
  public static resolveString(template: string, mergedVars: Record<string, any>): string {
    if (!template || typeof template !== 'string') {
      return template;
    }

    // Match {{variable_name}}
    return template.replace(/\{\{\s*([a-zA-Z0-9_$-]+)\s*\}\}/g, (match, varName) => {
      // Check dynamic built-ins
      if (varName.startsWith('$')) {
        const dyn = VariableResolver.getDynamicVariable(varName);
        if (dyn !== undefined) {
          return dyn;
        }
      }

      // Check merged variables
      if (Object.prototype.hasOwnProperty.call(mergedVars, varName)) {
        const val = mergedVars[varName];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return String(val);
      }

      // Return unchanged if not found
      return match;
    });
  }

  /**
   * Replaces path parameters formatted as :paramName with variable values
   */
  public static resolvePathParams(url: string, mergedVars: Record<string, any>): string {
    if (!url || typeof url !== 'string') {
      return url;
    }
    return url.replace(/:([a-zA-Z0-9_]+)/g, (match, paramName) => {
      if (Object.prototype.hasOwnProperty.call(mergedVars, paramName)) {
        return String(mergedVars[paramName]);
      }
      return match;
    });
  }

  /**
   * Resolves URL string or PostmanUrl object
   */
  public static resolveUrl(urlInput: PostmanUrl | string, mergedVars: Record<string, any>): string {
    let raw = typeof urlInput === 'string' ? urlInput : urlInput.raw || '';
    // First resolve {{var}}
    raw = VariableResolver.resolveString(raw, mergedVars);
    // Then resolve :pathParam
    raw = VariableResolver.resolvePathParams(raw, mergedVars);
    return raw;
  }

  /**
   * Resolves headers
   */
  public static resolveHeaders(headers: PostmanHeader[], mergedVars: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers || []) {
      if (!h.disabled && h.key) {
        const key = VariableResolver.resolveString(h.key, mergedVars).trim();
        const value = VariableResolver.resolveString(h.value || '', mergedVars);
        if (key) {
          result[key] = value;
        }
      }
    }
    return result;
  }

  /**
   * Resolves Authorization headers or parameters
   */
  public static resolveAuth(auth: PostmanAuth | undefined, mergedVars: Record<string, any>): Record<string, string> {
    const authHeaders: Record<string, string> = {};
    if (!auth || auth.type === 'noauth') {
      return authHeaders;
    }

    if (auth.type === 'bearer' && auth.bearer) {
      const tokenEntry = auth.bearer.find(b => b.key === 'token');
      if (tokenEntry && tokenEntry.value) {
        const token = VariableResolver.resolveString(tokenEntry.value, mergedVars);
        authHeaders['Authorization'] = `Bearer ${token}`;
      }
    } else if (auth.type === 'basic' && auth.basic) {
      const userEntry = auth.basic.find(b => b.key === 'username');
      const passEntry = auth.basic.find(b => b.key === 'password');
      const username = VariableResolver.resolveString(userEntry?.value || '', mergedVars);
      const password = VariableResolver.resolveString(passEntry?.value || '', mergedVars);
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      authHeaders['Authorization'] = `Basic ${encoded}`;
    } else if (auth.type === 'apikey' && auth.apikey) {
      const keyEntry = auth.apikey.find(k => k.key === 'key');
      const valEntry = auth.apikey.find(k => k.key === 'value');
      const inEntry = auth.apikey.find(k => k.key === 'in');
      const key = VariableResolver.resolveString(keyEntry?.value || '', mergedVars);
      const value = VariableResolver.resolveString(valEntry?.value || '', mergedVars);
      if (inEntry?.value === 'header' || !inEntry?.value) {
        if (key) {
          authHeaders[key] = value;
        }
      }
    }

    return authHeaders;
  }

  /**
   * Resolves body string (raw or urlencoded/formdata)
   */
  public static resolveBody(body: any, mergedVars: Record<string, any>): { bodyData: any; contentType?: string } {
    if (!body || body.mode === 'none') {
      return { bodyData: undefined };
    }

    if (body.mode === 'raw' && typeof body.raw === 'string') {
      const resolved = VariableResolver.resolveString(body.raw, mergedVars);
      const lang = body.options?.raw?.language || 'json';
      let contentType = 'text/plain';
      if (lang === 'json') {
        contentType = 'application/json';
      } else if (lang === 'html') {
        contentType = 'text/html';
      } else if (lang === 'xml') {
        contentType = 'application/xml';
      }
      return { bodyData: resolved, contentType };
    }

    if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
      const params = new URLSearchParams();
      for (const item of body.urlencoded) {
        if (!item.disabled && item.key) {
          const k = VariableResolver.resolveString(item.key, mergedVars);
          const v = VariableResolver.resolveString(item.value || '', mergedVars);
          params.append(k, v);
        }
      }
      return { bodyData: params.toString(), contentType: 'application/x-www-form-urlencoded' };
    }

    return { bodyData: body.raw || undefined };
  }
}
