import * as yaml from 'js-yaml';
import { PostmanCollection, PostmanItem } from '../types';

export interface OpenApiConversionOptions {
  baseUrl?: string;
  version?: string;
}

export class OpenApiConverter {
  /**
   * Converts a Postman Collection v2.1 into an OpenAPI 3.0.3 specification object.
   */
  public static toOpenApi(collection: PostmanCollection, options: OpenApiConversionOptions = {}): any {
    const title = collection.info?.name || 'Altman API Specification';
    const description = collection.info?.description || 'Exported from Postman Collection v2.1 via Altman Offline Client';
    const version = options.version || collection.info?.version || '1.0.0';

    const serverUrl = options.baseUrl || 'https://api.example.com';

    const paths: Record<string, any> = {};
    const securitySchemes: Record<string, any> = {};

    // Check collection-level auth
    let globalSecurity: any[] | undefined;
    if (collection.auth) {
      const authConfig = OpenApiConverter.extractSecurity(collection.auth, securitySchemes);
      if (authConfig) {
        globalSecurity = [authConfig];
      }
    }

    // Traverse all items recursively
    const allRequests: Array<{ item: PostmanItem; folderPath: string[] }> = [];
    OpenApiConverter.flattenItems(collection.item || [], [], allRequests);

    for (const { item, folderPath } of allRequests) {
      if (!item.request) continue;

      const rawUrl = typeof item.request.url === 'string'
        ? item.request.url
        : item.request.url?.raw || '';

      const { openApiPath, queryParams, pathParams } = OpenApiConverter.normalizePath(rawUrl, item.request.url);
      const method = (item.request.method || 'GET').toLowerCase();

      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      const operation: any = {
        summary: item.name,
        description: item.request.description || item.description || undefined,
        operationId: OpenApiConverter.generateOperationId(method, openApiPath, item.name),
        parameters: [],
        responses: {
          '200': {
            description: 'Successful response'
          }
        }
      };

      if (folderPath.length > 0) {
        operation.tags = [folderPath.join(' / ')];
      }

      // Add Path Parameters
      for (const p of pathParams) {
        operation.parameters.push({
          name: p,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `Path parameter ${p}`
        });
      }

      // Add Query Parameters
      for (const q of queryParams) {
        operation.parameters.push({
          name: q.key,
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            default: q.value || undefined
          },
          description: q.description || undefined
        });
      }

      // Add Headers
      if (Array.isArray(item.request.header)) {
        for (const h of item.request.header) {
          if (h.disabled || !h.key) continue;
          const lower = h.key.toLowerCase();
          if (lower === 'content-type' || lower === 'authorization') continue;

          operation.parameters.push({
            name: h.key,
            in: 'header',
            required: false,
            schema: {
              type: 'string',
              default: h.value || undefined
            },
            description: h.description || undefined
          });
        }
      }

      // Handle Request Body
      if (item.request.body && item.request.body.mode !== 'none' && method !== 'get' && method !== 'head') {
        const reqBody = OpenApiConverter.extractRequestBody(item.request.body);
        if (reqBody) {
          operation.requestBody = reqBody;
        }
      }

      // Handle Request-Level Auth
      if (item.request.auth && item.request.auth.type !== 'noauth') {
        const reqSecurity = OpenApiConverter.extractSecurity(item.request.auth, securitySchemes);
        if (reqSecurity) {
          operation.security = [reqSecurity];
        }
      }

      // Handle Saved Responses
      if (Array.isArray(item.response) && item.response.length > 0) {
        operation.responses = {};
        for (const resp of item.response) {
          const code = String(resp.code || 200);
          operation.responses[code] = {
            description: resp.name || `Response for status ${code}`
          };
          if (resp.body) {
            try {
              const parsed = JSON.parse(resp.body);
              operation.responses[code].content = {
                'application/json': {
                  schema: OpenApiConverter.inferSchema(parsed),
                  example: parsed
                }
              };
            } catch (e) {
              operation.responses[code].content = {
                'text/plain': {
                  schema: { type: 'string' },
                  example: resp.body
                }
              };
            }
          }
        }
      }

      paths[openApiPath][method] = operation;
    }

    const doc: any = {
      openapi: '3.0.3',
      info: {
        title,
        description,
        version
      },
      servers: [
        {
          url: serverUrl,
          description: 'Environment Server'
        }
      ],
      paths
    };

    if (globalSecurity && globalSecurity.length > 0) {
      doc.security = globalSecurity;
    }

    if (Object.keys(securitySchemes).length > 0) {
      doc.components = {
        securitySchemes
      };
    }

    return doc;
  }

  /**
   * Converts a Postman Collection to OpenAPI 3.0.3 YAML string.
   */
  public static toYaml(collection: PostmanCollection, options: OpenApiConversionOptions = {}): string {
    const doc = OpenApiConverter.toOpenApi(collection, options);
    return yaml.dump(doc, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
  }

  private static flattenItems(
    items: PostmanItem[],
    currentFolder: string[],
    result: Array<{ item: PostmanItem; folderPath: string[] }>
  ): void {
    for (const it of items) {
      if (Array.isArray(it.item)) {
        OpenApiConverter.flattenItems(it.item, [...currentFolder, it.name], result);
      } else if (it.request) {
        result.push({ item: it, folderPath: currentFolder });
      }
    }
  }

  private static normalizePath(
    rawUrl: string,
    urlObj?: any
  ): { openApiPath: string; queryParams: Array<{ key: string; value?: string; description?: string }>; pathParams: string[] } {
    let path = rawUrl.trim();

    // Strip protocol and host if present
    const protoIdx = path.indexOf('://');
    if (protoIdx >= 0) {
      const rest = path.substring(protoIdx + 3);
      const firstSlash = rest.indexOf('/');
      path = firstSlash >= 0 ? rest.substring(firstSlash) : '/';
    } else if (path.startsWith('{{baseUrl}}') || path.startsWith('{{host}}')) {
      path = path.replace(/^\{\{[^}]+\}\}/, '');
      if (!path.startsWith('/')) path = '/' + path;
    }

    // Strip Query Params
    const queryParams: Array<{ key: string; value?: string; description?: string }> = [];
    const qIdx = path.indexOf('?');
    if (qIdx >= 0) {
      const search = path.substring(qIdx + 1);
      path = path.substring(0, qIdx);
      const parts = search.split('&');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k) {
          queryParams.push({ key: decodeURIComponent(k), value: v ? decodeURIComponent(v) : '' });
        }
      }
    }

    // Merge query params from urlObj if provided
    if (urlObj && Array.isArray(urlObj.query)) {
      for (const q of urlObj.query) {
        if (!q.disabled && q.key && !queryParams.some(existing => existing.key === q.key)) {
          queryParams.push({ key: q.key, value: q.value, description: q.description });
        }
      }
    }

    // Extract & Convert Path Params: :paramName -> {paramName} and {{paramName}} -> {paramName}
    const pathParams: string[] = [];
    path = path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      if (!pathParams.includes(name)) pathParams.push(name);
      return `{${name}}`;
    });

    path = path.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
      if (!pathParams.includes(name)) pathParams.push(name);
      return `{${name}}`;
    });

    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    return {
      openApiPath: path,
      queryParams,
      pathParams
    };
  }

  private static extractRequestBody(body: any): any {
    if (!body || body.mode === 'none') return undefined;

    if (body.mode === 'raw') {
      const raw = body.raw || '';
      const lang = body.options?.raw?.language || 'json';

      if (lang === 'json') {
        try {
          const parsed = JSON.parse(raw);
          return {
            required: true,
            content: {
              'application/json': {
                schema: OpenApiConverter.inferSchema(parsed),
                example: parsed
              }
            }
          };
        } catch (e) {
          return {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: raw
              }
            }
          };
        }
      }

      return {
        required: true,
        content: {
          'text/plain': {
            schema: { type: 'string' },
            example: raw
          }
        }
      };
    }

    if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
      const properties: Record<string, any> = {};
      const example: Record<string, any> = {};
      for (const f of body.urlencoded) {
        if (!f.disabled && f.key) {
          properties[f.key] = { type: 'string', description: f.description || undefined };
          example[f.key] = f.value || '';
        }
      }
      return {
        required: true,
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              properties
            },
            example
          }
        }
      };
    }

    return undefined;
  }

  private static inferSchema(value: any): any {
    if (value === null) {
      return { nullable: true };
    }
    if (Array.isArray(value)) {
      return {
        type: 'array',
        items: value.length > 0 ? OpenApiConverter.inferSchema(value[0]) : { type: 'string' }
      };
    }
    if (typeof value === 'object') {
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        properties[k] = OpenApiConverter.inferSchema(v);
      }
      return {
        type: 'object',
        properties
      };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    }
    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }
    return { type: 'string' };
  }

  private static extractSecurity(auth: any, securitySchemes: Record<string, any>): Record<string, string[]> | undefined {
    if (!auth || auth.type === 'noauth') return undefined;

    if (auth.type === 'bearer') {
      securitySchemes['bearerAuth'] = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
      return { bearerAuth: [] };
    }

    if (auth.type === 'basic') {
      securitySchemes['basicAuth'] = {
        type: 'http',
        scheme: 'basic'
      };
      return { basicAuth: [] };
    }

    if (auth.type === 'apikey') {
      const keyName = auth.apikey?.find((k: any) => k.key === 'key')?.value || 'X-API-KEY';
      const inType = auth.apikey?.find((k: any) => k.key === 'in')?.value || 'header';
      securitySchemes['apiKeyAuth'] = {
        type: 'apiKey',
        in: inType,
        name: keyName
      };
      return { apiKeyAuth: [] };
    }

    return undefined;
  }

  private static generateOperationId(method: string, path: string, name: string): string {
    const cleanName = name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((w, idx) => (idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join('');
    return cleanName || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}
