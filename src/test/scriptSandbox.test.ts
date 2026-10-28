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

  it('should include lodash, moment and Math in evaluation of prerequest script', () => {
    const script = `
      // Test lodash via _ and lodash
      var arr = [1, 2, 3, 4, 5];
      var doubled = _.map(arr, function(n) { return n * 2; });
      var sum = lodash.sum(doubled);
      var user = { profile: { name: 'Altman User' } };
      var extractedName = _.get(user, 'profile.name', 'default');
      pm.environment.set('sum_val', sum);
      pm.environment.set('extracted_name', extractedName);

      // Test moment
      var formatted = moment('2026-10-28T12:00:00Z').format('YYYY-MM-DD');
      var unixTs = moment('2026-10-28T12:00:00Z').unix();
      pm.environment.set('date_formatted', formatted);
      pm.environment.set('date_unix', unixTs);

      // Test Math
      var maxVal = Math.max(10, 42, 5);
      var floorVal = Math.floor(4.99);
      var absVal = Math.abs(-123);
      pm.environment.set('math_max', maxVal);
      pm.environment.set('math_floor', floorVal);
      pm.environment.set('math_abs', absVal);

      // Test require('lodash') and require('moment')
      var reqLodash = require('lodash');
      var reqMoment = require('moment');
      pm.environment.set('require_lodash_ok', typeof reqLodash.chunk === 'function');
      pm.environment.set('require_moment_ok', typeof reqMoment === 'function');
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: {},
      localVars: {}
    });

    expect(result.error).to.be.undefined;
    expect(result.mutatedEnvironment['sum_val']).to.equal(30);
    expect(result.mutatedEnvironment['extracted_name']).to.equal('Altman User');
    expect(result.mutatedEnvironment['date_formatted']).to.equal('2026-10-28');
    expect(result.mutatedEnvironment['date_unix']).to.equal(1793188800);
    expect(result.mutatedEnvironment['math_max']).to.equal(42);
    expect(result.mutatedEnvironment['math_floor']).to.equal(4);
    expect(result.mutatedEnvironment['math_abs']).to.equal(123);
    expect(result.mutatedEnvironment['require_lodash_ok']).to.equal(true);
    expect(result.mutatedEnvironment['require_moment_ok']).to.equal(true);
  });

  it('should prevent access to sensitive Node process globals in sandbox', () => {
    const script = `
      var procType = typeof process;
      pm.environment.set('process_type', procType);
    `;

    const result = ScriptSandbox.runScript({
      scriptContent: script,
      stage: 'prerequest',
      environmentVars: {},
      collectionVars: {},
      localVars: {}
    });

    expect(result.mutatedEnvironment['process_type']).to.equal('undefined');
  });
});

