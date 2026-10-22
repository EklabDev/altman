import { expect } from 'chai';
import { VariableResolver } from '../engine/variableResolver';

describe('VariableResolver', () => {
  it('should substitute {{variable}} in string templates', () => {
    const template = 'https://{{host}}:{{port}}/users/{{userId}}';
    const vars = { host: 'api.local', port: '8080', userId: '42' };
    const resolved = VariableResolver.resolveString(template, vars);
    expect(resolved).to.equal('https://api.local:8080/users/42');
  });

  it('should resolve dynamic variables {{$timestamp}} and {{$guid}}', () => {
    const template = 'id={{$guid}}&ts={{$timestamp}}';
    const resolved = VariableResolver.resolveString(template, {});
    expect(resolved).to.match(/id=[a-f0-9-]{36}&ts=\d+/);
  });

  it('should replace path parameters :param with values', () => {
    const url = 'https://api.local/v1/orders/:orderId/items/:itemId';
    const vars = { orderId: '999', itemId: '12' };
    const resolved = VariableResolver.resolvePathParams(url, vars);
    expect(resolved).to.equal('https://api.local/v1/orders/999/items/12');
  });

  it('should observe variable precedence: Local > Environment > Collection > Global', () => {
    const merged = VariableResolver.mergeVariables({
      global: { token: 'global_token', host: 'global.com' },
      collection: { token: 'coll_token', port: '8000' },
      environment: { token: 'env_token', port: '8080' },
      local: { token: 'local_token' }
    });

    expect(merged.token).to.equal('local_token');
    expect(merged.port).to.equal('8080');
    expect(merged.host).to.equal('global.com');
  });

  it('should resolve headers and authentication', () => {
    const headers = [
      { key: 'X-API-KEY', value: '{{apiKey}}' },
      { key: 'Accept', value: 'application/json' }
    ];
    const vars = { apiKey: 'key_xyz' };
    const resolved = VariableResolver.resolveHeaders(headers, vars);
    expect(resolved['X-API-KEY']).to.equal('key_xyz');
    expect(resolved['Accept']).to.equal('application/json');

    const auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{bearerToken}}', type: 'string' }]
    };
    const resolvedAuth = VariableResolver.resolveAuth(auth, { bearerToken: 'jwt_abc' });
    expect(resolvedAuth['Authorization']).to.equal('Bearer jwt_abc');
  });
});
