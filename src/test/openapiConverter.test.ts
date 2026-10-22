import { expect } from 'chai';
import * as yaml from 'js-yaml';
import { OpenApiConverter } from '../engine/openapiConverter';
import { PostmanCollection } from '../types';

describe('OpenApiConverter', () => {
  const sampleCollection: PostmanCollection = {
    info: {
      name: 'Order API',
      description: 'API for orders management',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '2.0.0'
    },
    item: [
      {
        name: 'Get Order By ID',
        request: {
          method: 'GET',
          url: {
            raw: 'https://api.example.com/v1/orders/:orderId?detailed=true',
            host: ['api', 'example', 'com'],
            path: ['v1', 'orders', ':orderId'],
            query: [{ key: 'detailed', value: 'true' }]
          },
          header: [{ key: 'X-Tenant-Id', value: 'tenant_123' }]
        }
      },
      {
        name: 'Create New Order',
        request: {
          method: 'POST',
          url: 'https://api.example.com/v1/orders',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            options: { raw: { language: 'json' } },
            raw: JSON.stringify({ customerId: 'cust_01', items: [{ id: 1, quantity: 2 }] })
          },
          auth: {
            type: 'bearer',
            bearer: [{ key: 'token', value: 'my_token', type: 'string' }]
          }
        }
      }
    ]
  };

  it('should convert collection to valid OpenAPI 3.0.3 YAML', () => {
    const yamlString = OpenApiConverter.toYaml(sampleCollection, { baseUrl: 'https://api.example.com' });
    expect(yamlString).to.include('openapi: 3.0.3');
    expect(yamlString).to.include('title: Order API');
    expect(yamlString).to.include('/v1/orders/{orderId}');
    expect(yamlString).to.include('name: orderId');
    expect(yamlString).to.include('in: path');
    expect(yamlString).to.include('name: detailed');
    expect(yamlString).to.include('in: query');
    expect(yamlString).to.include('name: X-Tenant-Id');
    expect(yamlString).to.include('in: header');

    // Parse back from YAML to verify validity
    const parsed = yaml.load(yamlString) as any;
    expect(parsed.openapi).to.equal('3.0.3');
    expect(parsed.info.title).to.equal('Order API');
    expect(parsed.paths['/v1/orders/{orderId}'].get).to.exist;
    expect(parsed.paths['/v1/orders'].post).to.exist;

    // Check requestBody
    const postOp = parsed.paths['/v1/orders'].post;
    expect(postOp.requestBody.content['application/json'].schema.type).to.equal('object');
    expect(postOp.security[0].bearerAuth).to.exist;
  });
});
