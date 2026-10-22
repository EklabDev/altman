import { expect } from 'chai';
import { NewmanGenerator } from '../engine/newmanGenerator';

describe('NewmanGenerator', () => {
  it('should compose basic Newman CLI command', () => {
    const cmd = NewmanGenerator.composeCommand({
      collectionPath: '.altman/collections/Auth_API.json',
      insecureSsl: true
    });

    expect(cmd).to.equal('npx newman run ".altman/collections/Auth_API.json" --insecure --reporters cli');
  });

  it('should compose full Newman CLI command with environment, delay, iterations, and bail', () => {
    const cmd = NewmanGenerator.composeCommand({
      collectionPath: '.altman/collections/Auth_API.json',
      environmentPath: '.altman/environments/Local.altman_env.json',
      iterationCount: 3,
      delayRequestMs: 250,
      insecureSsl: true,
      bailOnError: true,
      reporters: ['cli', 'html']
    });

    expect(cmd).to.equal(
      'npx newman run ".altman/collections/Auth_API.json" -e ".altman/environments/Local.altman_env.json" -n 3 --delay-request 250 --insecure --bail --reporters cli,html'
    );
  });
});
