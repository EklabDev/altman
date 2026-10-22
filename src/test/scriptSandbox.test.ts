import { expect } from 'chai';
import { ScriptSandbox } from '../engine/scriptSandbox';

describe('ScriptSandbox', () => {
  it('should run pre-request script and mutate environment variables', () => {
    const script = `
      pm.environment.set('computed_token', 'token_' + (100 + 23));
      console.log('Token computed in sandbox');
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: {},
      localVars: {}
    });

    expect(result.mutatedEnvironment['computed_token']).to.equal('token_123');
    expect(result.logs.length).to.be.greaterThan(0);
    expect(result.logs[0].message).to.include('Token computed in sandbox');
  });

  it('should have jsrsasign bundled and accessible in script', () => {
    const script = `
      // Verify jsrsasign presence and functionality
      var hex = '616263'; // hex of 'abc'
      var b64 = jsrsasign.hextob64(hex);
      pm.environment.set('b64_output', b64);

      // Verify KJUR and KEYUTIL
      var hasKJUR = typeof KJUR !== 'undefined';
      var hasKEYUTIL = typeof KEYUTIL !== 'undefined';
      pm.environment.set('hasKJUR', hasKJUR);
      pm.environment.set('hasKEYUTIL', hasKEYUTIL);
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: {},
      localVars: {}
    });

    expect(result.error).to.be.undefined;
    expect(result.mutatedEnvironment['b64_output']).to.equal('YWJj');
    expect(result.mutatedEnvironment['hasKJUR']).to.equal(true);
    expect(result.mutatedEnvironment['hasKEYUTIL']).to.equal(true);
  });

  it('should have CryptoJS available and hash values', () => {
    const script = `
      var hash = CryptoJS.SHA256("message").toString();
      pm.environment.set('sha256_hash', hash);
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: {},
      localVars: {}
    });

    expect(result.error).to.be.undefined;
    expect(result.mutatedEnvironment['sha256_hash']).to.equal(
      'ab530a13e45914982b79f9b7e3fba994cfd1f3fb22f71cea1afbf02b460c6d1d'
    );
  });

  it('should run post-request test assertions using pm.test and pm.expect', () => {
    const script = `
      pm.test("Status code is 200", function () {
        pm.expect(pm.response.code).to.equal(200);
      });

      pm.test("Response body contains expected key", function () {
        var jsonData = pm.response.json();
        pm.expect(jsonData.success).to.be.true;
      });

      pm.test("Failing test example", function () {
        pm.expect(pm.response.code).to.equal(404);
      });
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'test',
      environmentVars: {},
      collectionVars: {},
      localVars: {},
      response: {
        code: 200,
        status: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ success: true, user: 'test' }),
        responseTime: 120
      }
    });

    expect(result.testResults.length).to.equal(3);
    expect(result.testResults[0].passed).to.be.true;
    expect(result.testResults[1].passed).to.be.true;
    expect(result.testResults[2].passed).to.be.false;
    expect(result.testResults[2].error).to.include('expected 200 to equal 404');
  });

  it('should support pm.collectionVariables get and set', () => {
    const script = `
      var existing = pm.collectionVariables.get('api_base');
      pm.collectionVariables.set('api_base', existing + '/v2');
      pm.collectionVariables.set('new_coll_var', 'coll_value_123');
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: { api_base: 'https://api.example.com' },
      localVars: {}
    });

    expect(result.mutatedCollectionVars['api_base']).to.equal('https://api.example.com/v2');
    expect(result.mutatedCollectionVars['new_coll_var']).to.equal('coll_value_123');
  });
});
