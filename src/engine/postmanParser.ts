import { PostmanCollection, PostmanEnvironment, PostmanItem } from '../types';

export class PostmanParser {
  /**
   * Validates and normalizes imported Postman Collection v2.1 JSON
   */
  public static parseCollection(rawJson: string | object): PostmanCollection {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON: Root must be an object.');
    }

    if (!data.info || !data.info.name) {
      throw new Error('Invalid Postman Collection: Missing info.name property.');
    }

    const normalized: PostmanCollection = {
      info: {
        _postman_id: data.info._postman_id || undefined,
        name: data.info.name,
        description: data.info.description || '',
        schema: data.info.schema || 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        version: data.info.version || undefined
      },
      item: Array.isArray(data.item) ? data.item.map((item: any) => PostmanParser.normalizeItem(item)) : [],
      event: Array.isArray(data.event) ? data.event : [],
      variable: Array.isArray(data.variable) ? data.variable : [],
      auth: data.auth || undefined
    };

    return normalized;
  }

  /**
   * Normalizes an individual Item or Folder (ItemGroup)
   */
  public static normalizeItem(item: any): PostmanItem {
    const isFolder = Array.isArray(item.item);

    if (isFolder) {
      return {
        id: item.id || undefined,
        name: item.name || 'Untitled Folder',
        description: item.description || '',
        event: Array.isArray(item.event) ? item.event : [],
        item: item.item.map((sub: any) => PostmanParser.normalizeItem(sub))
      };
    }

    // It is a request
    let url: any = item.request?.url || '';
    if (typeof url === 'string') {
      url = { raw: url };
    } else if (typeof url === 'object' && !url.raw) {
      // Reconstruct raw if missing
      const protocol = url.protocol ? `${url.protocol}://` : '';
      const host = Array.isArray(url.host) ? url.host.join('.') : '';
      const port = url.port ? `:${url.port}` : '';
      const pathPart = Array.isArray(url.path) ? `/${url.path.join('/')}` : '';
      url.raw = `${protocol}${host}${port}${pathPart}`;
    }

    return {
      id: item.id || undefined,
      name: item.name || 'Untitled Request',
      description: item.description || '',
      request: {
        method: item.request?.method || 'GET',
        header: Array.isArray(item.request?.header) ? item.request.header : [],
        url,
        body: item.request?.body || { mode: 'none' },
        description: item.request?.description || '',
        auth: item.request?.auth || undefined
      },
      event: Array.isArray(item.event) ? item.event : [],
      response: Array.isArray(item.response) ? item.response : []
    };
  }

  /**
   * Serializes collection to standard Postman v2.1.0 JSON
   */
  public static exportCollection(collection: PostmanCollection): string {
    const exportData: PostmanCollection = {
      info: {
        _postman_id: collection.info._postman_id || undefined,
        name: collection.info.name,
        description: collection.info.description || '',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        version: collection.info.version
      },
      item: collection.item || [],
      event: collection.event || [],
      variable: collection.variable || [],
      auth: collection.auth
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Validates and parses a Postman Environment JSON
   */
  public static parseEnvironment(rawJson: string | object): PostmanEnvironment {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON: Root must be an object.');
    }

    if (!data.name) {
      throw new Error('Invalid Postman Environment: Missing environment name.');
    }

    return {
      id: data.id || undefined,
      name: data.name,
      values: Array.isArray(data.values)
        ? data.values.map((v: any) => ({
            key: v.key || '',
            value: v.value !== undefined ? String(v.value) : '',
            type: v.type || 'default',
            enabled: v.enabled !== false
          }))
        : [],
      _postman_variable_scope: 'environment',
      _postman_exported_at: new Date().toISOString(),
      _postman_exported_using: 'Altman Local Client'
    };
  }

  /**
   * Serializes environment to Postman Environment JSON
   */
  public static exportEnvironment(env: PostmanEnvironment): string {
    return JSON.stringify(env, null, 2);
  }
}
