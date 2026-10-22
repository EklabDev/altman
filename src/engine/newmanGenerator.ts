// Type-only import for vscode types; runtime require is performed dynamically
import type * as vscodeTypes from 'vscode';

export interface NewmanOptions {
  collectionPath: string;
  environmentPath?: string;
  iterationCount?: number;
  delayRequestMs?: number;
  insecureSsl?: boolean;
  bailOnError?: boolean;
  reporters?: string[];
  exportEnvironmentPath?: string;
}

export class NewmanGenerator {
  /**
   * Composes a newman CLI command string
   */
  public static composeCommand(options: NewmanOptions): string {
    const args: string[] = ['npx newman run'];

    // Quote collection path
    args.push(`"${options.collectionPath}"`);

    // Environment
    if (options.environmentPath) {
      args.push(`-e "${options.environmentPath}"`);
    }

    // Iterations
    if (options.iterationCount && options.iterationCount > 1) {
      args.push(`-n ${options.iterationCount}`);
    }

    // Delay
    if (options.delayRequestMs && options.delayRequestMs > 0) {
      args.push(`--delay-request ${options.delayRequestMs}`);
    }

    // Insecure SSL
    if (options.insecureSsl) {
      args.push('--insecure');
    }

    // Bail
    if (options.bailOnError) {
      args.push('--bail');
    }

    // Reporters
    const reporters = options.reporters && options.reporters.length > 0
      ? options.reporters.join(',')
      : 'cli';
    args.push(`--reporters ${reporters}`);

    // Export environment after run if requested
    if (options.exportEnvironmentPath) {
      args.push(`--export-environment "${options.exportEnvironmentPath}"`);
    }

    return args.join(' ');
  }

  /**
   * Spawns or reuses a VS Code integrated terminal and executes the Newman command
   */
  public static runInTerminal(command: string): vscodeTypes.Terminal {
    let vscode: typeof vscodeTypes;
    try {
      vscode = require('vscode');
    } catch (e) {
      throw new Error('VS Code API is only available when running inside VS Code extension host.');
    }
    const terminalName = 'Altman Newman Runner';
    let terminal = vscode.window.terminals.find(t => t.name === terminalName);
    if (!terminal) {
      terminal = vscode.window.createTerminal(terminalName);
    }
    terminal.show();
    terminal.sendText(command);
    return terminal;
  }
}
