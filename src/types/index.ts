export interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  description?: string;
  disabled?: boolean;
}

export interface PostmanAuth {
  type: 'noauth' | 'bearer' | 'basic' | 'apikey' | string;
  bearer?: Array<{ key: string; value: string; type: string }>;
  basic?: Array<{ key: string; value: string; type: string }>;
  apikey?: Array<{ key: string; value: string; type: string }>;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'none';
  raw?: string;
  options?: {
    raw?: {
      language?: 'json' | 'text' | 'html' | 'xml' | 'javascript';
    };
  };
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean; description?: string }>;
  formdata?: Array<{ key: string; value: string; type?: 'text' | 'file'; disabled?: boolean }>;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: Array<{ key: string; value: string; description?: string }>;
}

export interface PostmanScript {
  id?: string;
  type: string;
  exec: string[] | string;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: PostmanScript;
}

export interface PostmanItem {
  id?: string;
  name: string;
  description?: string;
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    header: PostmanHeader[];
    body?: PostmanBody;
    url: PostmanUrl | string;
    description?: string;
    auth?: PostmanAuth;
  };
  response?: any[];
  event?: PostmanEvent[];
  item?: PostmanItem[]; // Folders have sub-items
}

export interface PostmanCollection {
  info: {
    _postman_id?: string;
    name: string;
    description?: string;
    schema: string; // "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    version?: string;
  };
  item: PostmanItem[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanEnvironmentValue {
  key: string;
  value: string;
  type?: 'default' | 'secret';
  enabled: boolean;
}

export interface PostmanEnvironment {
  id?: string;
  name: string;
  values: PostmanEnvironmentValue[];
  _postman_variable_scope?: 'environment';
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

export interface ExecutionLog {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ExecutionResponse {
  statusCode: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string | string[]>;
  body: string;
  contentType: string;
  isJson: boolean;
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>;
  testResults: TestResult[];
  logs: ExecutionLog[];
  resolvedRequest: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
}

export interface RequestHistoryItem {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  statusCode: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  collectionName?: string;
  requestName?: string;
}
