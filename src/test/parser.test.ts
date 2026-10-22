import { expect } from 'chai';
import { PostmanParser } from '../engine/postmanParser';

describe('PostmanParser', () => {
  it('should parse a valid Postman Collection v2.1 JSON', () => {
    const raw = {
      info: {
        _postman_id: '12345',
        name: 'User Management API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [
        {
          name: 'Get User Profile',
          request: {
            method: 'GET',
            url: {
              raw: 'https://api.example.com/v1/users/{{userId}}',
              host: ['api', 'example', 'com'],
              path: ['v1', 'users', '{{userId}}']
            },
            header: [
              { key: 'Accept', value: 'application/json' }
            ]
          }
        }
      ]
    };

    const parsed = PostmanParser.parseCollection(raw);
    expect(parsed.info.name).to.equal('User Management API');
    expect(parsed.item.length).to.equal(1);
    expect(parsed.item[0].request?.method).to.equal('GET');
  });

  it('should correctly normalize nested folders in collection', () => {
    const raw = {
      info: { name: 'Nested API' },
      item: [
        {
          name: 'Auth Folder',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                url: 'https://api.example.com/auth/login'
              }
            }
          ]
        }
      ]
    };

    const parsed = PostmanParser.parseCollection(raw);
    expect(parsed.item.length).to.equal(1);
    expect(parsed.item[0].item?.length).to.equal(1);
    expect(parsed.item[0].item?.[0].request?.method).to.equal('POST');
  });

  it('should parse and export Postman Environment JSON', () => {
    const rawEnv = {
      name: 'Staging Env',
      values: [
        { key: 'baseUrl', value: 'https://staging.api.com', enabled: true },
        { key: 'apiKey', value: 'secret_123', enabled: true }
      ]
    };

    const parsed = PostmanParser.parseEnvironment(rawEnv);
    expect(parsed.name).to.equal('Staging Env');
    expect(parsed.values.length).to.equal(2);

    const exported = PostmanParser.exportEnvironment(parsed);
    expect(exported).to.include('staging.api.com');
  });
});
