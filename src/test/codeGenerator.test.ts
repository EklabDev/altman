import { expect } from 'chai';
import { CodeGenerator } from '../engine/codeGenerator';

describe('CodeGenerator', () => {
  const sampleRequest = {
    url: 'https://api.example.com/v1/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer my_token'
    },
    body: JSON.stringify({ item: 'Widget', qty: 5 }),
    contentType: 'application/json'
  };

  it('should generate valid cURL command', () => {
    const curl = CodeGenerator.toCurl(sampleRequest);
    expect(curl).to.include('curl --location');
    expect(curl).to.include("--request POST 'https://api.example.com/v1/orders'");
    expect(curl).to.include("--header 'Authorization: Bearer my_token'");
    expect(curl).to.include('--data \'{"item":"Widget","qty":5}\'');
  });

  it('should generate Node.js fetch snippet', () => {
    const nodeCode = CodeGenerator.toNodeFetch(sampleRequest);
    expect(nodeCode).to.include('fetch(url, options)');
    expect(nodeCode).to.include("method: 'POST'");
  });

  it('should generate Python requests snippet', () => {
    const pyCode = CodeGenerator.toPython(sampleRequest);
    expect(pyCode).to.include('import requests');
    expect(pyCode).to.include('requests.request("POST", url, headers=headers');
  });

  it('should generate Java 11+ HttpClient snippet', () => {
    const javaCode = CodeGenerator.toJava(sampleRequest);
    expect(javaCode).to.include('HttpClient client = HttpClient.newHttpClient()');
    expect(javaCode).to.include('.method("POST", HttpRequest.BodyPublishers.ofString(');
  });
});
