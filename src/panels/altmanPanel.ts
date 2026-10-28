import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AltmanStorage } from '../storage/altmanStorage';
import { PostmanCollection, PostmanEnvironment, PostmanItem } from '../types';
import { VariableResolver } from '../engine/variableResolver';
import { ScriptSandbox } from '../engine/scriptSandbox';
import { HttpClient } from '../engine/httpClient';
import { PostmanParser } from '../engine/postmanParser';
import { CodeGenerator, CodeSnippetRequest } from '../engine/codeGenerator';
import { NewmanGenerator, NewmanOptions } from '../engine/newmanGenerator';
import { OpenApiConverter } from '../engine/openapiConverter';

export class AltmanPanel {
  public static currentPanel: AltmanPanel | undefined;
  public static outputChannel = vscode.window.createOutputChannel('Altman');
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _storage: AltmanStorage;

  public static logOutput(level: string, message: string) {
    const timeStr = new Date().toLocaleTimeString();
    AltmanPanel.outputChannel.appendLine(`[${timeStr}] [${level.toUpperCase()}] ${message}`);
  }

  public loadSpecificRequest(collectionName: string, requestName: string) {
    this._panel.webview.postMessage({
      type: 'loadSpecificRequest',
      collectionName,
      requestName
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, storage: AltmanStorage) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (AltmanPanel.currentPanel) {
      AltmanPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'altmanClient',
      'Altman API Client',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    AltmanPanel.currentPanel = new AltmanPanel(panel, extensionUri, storage);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, storage: AltmanStorage) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._storage = storage;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async message => {
        try {
          await this._handleMessage(message);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Altman Error: ${err.message}`);
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    AltmanPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public refreshFromDisk() {
    const collections = this._storage.listCollections();
    const environments = this._storage.listEnvironments();
    const settings = this._storage.getSettings();
    const history = this._storage.getHistory();
    this._panel.webview.postMessage({
      type: 'diskReloaded',
      data: {
        collections,
        environments,
        settings,
        history,
        activeEnvironmentName: settings.activeEnvironmentName
      }
    });
  }

  private async _handleMessage(message: any) {
    switch (message.type) {
      case 'getInitialData': {
        const collections = this._storage.listCollections();
        const environments = this._storage.listEnvironments();
        const settings = this._storage.getSettings();
        const history = this._storage.getHistory();
        this._panel.webview.postMessage({
          type: 'initialDataLoaded',
          data: {
            collections,
            environments,
            settings,
            history,
            activeEnvironmentName: settings.activeEnvironmentName
          }
        });
        break;
      }

      case 'setActiveEnvironment': {
        this._storage.saveSettings({ activeEnvironmentName: message.name });
        break;
      }

      case 'saveCollection': {
        const coll = message.collection as PostmanCollection;
        const originalName = message.originalName as string | undefined;
        this._storage.saveCollection(coll, originalName);
        vscode.window.showInformationMessage(`Collection '${coll.info.name}' saved to .altman/collections`);
        this._panel.webview.postMessage({
          type: 'collectionsUpdated',
          collections: this._storage.listCollections()
        });
        vscode.commands.executeCommand('altman.refreshAllViews');
        break;
      }

      case 'deleteCollection': {
        const name = message.name;
        this._storage.deleteCollection(name);
        vscode.window.showInformationMessage(`Collection '${name}' deleted.`);
        this._panel.webview.postMessage({
          type: 'collectionsUpdated',
          collections: this._storage.listCollections()
        });
        vscode.commands.executeCommand('altman.refreshAllViews');
        break;
      }

      case 'saveEnvironment': {
        const env = message.environment as PostmanEnvironment;
        const originalName = message.originalName as string | undefined;
        this._storage.saveEnvironment(env, originalName);
        vscode.window.showInformationMessage(`Environment '${env.name}' saved to .altman/environments`);
        this._panel.webview.postMessage({
          type: 'environmentsUpdated',
          environments: this._storage.listEnvironments()
        });
        vscode.commands.executeCommand('altman.refreshAllViews');
        break;
      }

      case 'reloadFromDisk': {
        this.refreshFromDisk();
        vscode.window.showInformationMessage('Altman: Reloaded collections and environments from local files.');
        vscode.commands.executeCommand('altman.refreshAllViews');
        break;
      }

      case 'deleteEnvironment': {
        const name = message.name;
        this._storage.deleteEnvironment(name);
        const settings = this._storage.getSettings();
        if (settings.activeEnvironmentName === name) {
          settings.activeEnvironmentName = undefined;
          this._storage.saveSettings(settings);
        }
        vscode.window.showInformationMessage(`Environment '${name}' deleted.`);
        this._panel.webview.postMessage({
          type: 'environmentsUpdated',
          environments: this._storage.listEnvironments()
        });
        vscode.commands.executeCommand('altman.refreshAllViews');
        break;
      }

      case 'importCollectionFile': {
        const fileUris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'Postman Collection v2.1': ['json'] },
          title: 'Select Postman Collection v2.1 JSON'
        });
        if (fileUris && fileUris[0]) {
          const parsed = this._storage.importCollectionFromFile(fileUris[0].fsPath);
          vscode.window.showInformationMessage(`Imported collection '${parsed.info.name}' to .altman/collections`);
          this._panel.webview.postMessage({
            type: 'collectionsUpdated',
            collections: this._storage.listCollections()
          });
        }
        break;
      }

      case 'exportCollectionFile': {
        const collName = message.collectionName;
        const targetUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${collName}.postman_collection.json`),
          filters: { 'Postman Collection v2.1': ['json'] },
          title: 'Export Postman Collection v2.1'
        });
        if (targetUri) {
          this._storage.exportCollectionToFile(collName, targetUri.fsPath);
          vscode.window.showInformationMessage(`Exported '${collName}' to ${targetUri.fsPath}`);
        }
        break;
      }

      case 'executeRequest': {
        await this._executeRequest(message.payload);
        break;
      }

      case 'generateCode': {
        const req = message.request as CodeSnippetRequest;
        const curl = CodeGenerator.toCurl(req);
        const node = CodeGenerator.toNodeFetch(req);
        const python = CodeGenerator.toPython(req);
        const java = CodeGenerator.toJava(req);

        this._panel.webview.postMessage({
          type: 'codeGenerated',
          code: { curl, node, python, java }
        });
        break;
      }

      case 'runNewmanCommand': {
        const options: NewmanOptions = message.options;
        const command = NewmanGenerator.composeCommand(options);
        if (message.executeInTerminal) {
          NewmanGenerator.runInTerminal(command);
          vscode.window.showInformationMessage('Launched Newman in integrated terminal.');
        } else {
          this._panel.webview.postMessage({
            type: 'newmanCommandComposed',
            command
          });
        }
        break;
      }

      case 'clearHistory': {
        this._storage.clearHistory();
        this._panel.webview.postMessage({
          type: 'historyCleared'
        });
        break;
      }

      case 'generateOpenApiYaml': {
        const collName = message.collectionName;
        const coll = collName ? this._storage.getCollection(collName) : this._storage.listCollections()[0];
        if (!coll) {
          this._panel.webview.postMessage({
            type: 'openApiYamlGenerated',
            yaml: '# No collection available in .altman/collections.\n# Click "Import" or "+ Collection" to create one.'
          });
          break;
        }

        const settings = this._storage.getSettings();
        let baseUrl = 'https://api.example.com';
        if (settings.activeEnvironmentName) {
          const env = this._storage.getEnvironment(settings.activeEnvironmentName);
          const b = env?.values.find(v => v.key === 'baseUrl' || v.key === 'host');
          if (b && b.value) baseUrl = b.value;
        }

        const doc = OpenApiConverter.toOpenApi(coll, { baseUrl });
        const yamlContent = OpenApiConverter.toYaml(coll, { baseUrl });
        this._panel.webview.postMessage({
          type: 'openApiYamlGenerated',
          yaml: yamlContent,
          spec: doc,
          collectionName: coll.info.name
        });
        break;
      }

      case 'exportOpenApiYaml': {
        const collName = message.collectionName;
        const coll = collName ? this._storage.getCollection(collName) : this._storage.listCollections()[0];
        if (!coll) {
          vscode.window.showWarningMessage('No collection found to export as OpenAPI YAML.');
          break;
        }

        const settings = this._storage.getSettings();
        let baseUrl = 'https://api.example.com';
        if (settings.activeEnvironmentName) {
          const env = this._storage.getEnvironment(settings.activeEnvironmentName);
          const b = env?.values.find(v => v.key === 'baseUrl' || v.key === 'host');
          if (b && b.value) baseUrl = b.value;
        }

        const yamlContent = OpenApiConverter.toYaml(coll, { baseUrl });
        const targetUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${coll.info.name}.openapi.yaml`),
          filters: { 'OpenAPI 3.0 YAML': ['yaml', 'yml'] },
          title: 'Export OpenAPI 3.0 YAML'
        });

        if (targetUri) {
          fs.writeFileSync(targetUri.fsPath, yamlContent, 'utf8');
          vscode.window.showInformationMessage(`Exported OpenAPI 3.0 YAML to ${targetUri.fsPath}`);
        }
        break;
      }
    }
  }

  private async _executeRequest(payload: {
    request: {
      method: string;
      url: string;
      headers: Array<{ key: string; value: string; disabled?: boolean }>;
      auth?: any;
      body?: any;
      preRequestScript?: string;
      testScript?: string;
      collectionName?: string;
      requestName?: string;
    };
    activeEnvironmentName?: string;
  }) {
    const { request, activeEnvironmentName } = payload;
    const settings = this._storage.getSettings();

    // 1. Gather variables from active environment
    let envVars: Record<string, any> = {};
    let activeEnv: PostmanEnvironment | undefined;
    if (activeEnvironmentName) {
      activeEnv = this._storage.getEnvironment(activeEnvironmentName);
      if (activeEnv) {
        for (const v of activeEnv.values) {
          if (v.enabled) {
            envVars[v.key] = v.value;
          }
        }
      }
    }

    // 2. Gather collection variables
    let collVars: Record<string, any> = {};
    let coll: PostmanCollection | undefined;
    if (request.collectionName) {
      coll = this._storage.getCollection(request.collectionName);
      if (coll && coll.variable) {
        for (const cv of coll.variable) {
          if (!cv.disabled) {
            collVars[cv.key] = cv.value;
          }
        }
      }
    }

    let localVars: Record<string, any> = {};
    const logs: any[] = [];
    const addLog = (level: 'log' | 'info' | 'warn' | 'error', message: string) => {
      const entry = { level, message, timestamp: Date.now() };
      logs.push(entry);
      AltmanPanel.logOutput(level, message);
    };

    // 3. Run Pre-request scripts (Collection-level runs first, then Request-level)
    const collPreScript = coll?.event?.find(e => e.listen === 'prerequest')?.script;
    if (collPreScript) {
      const scriptCode = Array.isArray(collPreScript.exec) ? collPreScript.exec.join('\n') : (collPreScript.exec || '');
      if (scriptCode.trim()) {
        const collPreResult = ScriptSandbox.runScript({
          scriptContent: scriptCode,
          stage: 'prerequest',
          environmentVars: envVars,
          collectionVars: collVars,
          localVars: localVars,
          request: {
            url: request.url,
            method: request.method,
            headers: {},
            body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
          }
        });
        for (const l of collPreResult.logs) {
          logs.push(l);
          AltmanPanel.logOutput(l.level, `[SCRIPT:Collection-Pre] ${l.message}`);
        }
        envVars = collPreResult.mutatedEnvironment;
        collVars = collPreResult.mutatedCollectionVars;
        localVars = collPreResult.mutatedLocalVars;
      }
    }

    if (request.preRequestScript && request.preRequestScript.trim()) {
      const preResult = ScriptSandbox.runScript({
        scriptContent: request.preRequestScript,
        stage: 'prerequest',
        environmentVars: envVars,
        collectionVars: collVars,
        localVars: localVars,
        request: {
          url: request.url,
          method: request.method,
          headers: {},
          body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
        }
      });
      for (const l of preResult.logs) {
        logs.push(l);
        AltmanPanel.logOutput(l.level, `[SCRIPT:Pre-Request] ${l.message}`);
      }
      envVars = preResult.mutatedEnvironment;
      collVars = preResult.mutatedCollectionVars;
      localVars = preResult.mutatedLocalVars;

      // Update environment values back in storage if modified
      if (activeEnv) {
        let changed = false;
        for (const [k, v] of Object.entries(envVars)) {
          const existing = activeEnv.values.find(ev => ev.key === k);
          if (existing && existing.value !== String(v)) {
            existing.value = String(v);
            changed = true;
          } else if (!existing) {
            activeEnv.values.push({ key: k, value: String(v), enabled: true });
            changed = true;
          }
        }
        if (changed) {
          this._storage.saveEnvironment(activeEnv);
        }
      }

      // Update collection variables back in storage if modified
      if (coll) {
        let collChanged = false;
        if (!coll.variable) coll.variable = [];
        for (const [k, v] of Object.entries(collVars)) {
          const existing = coll.variable.find(cv => cv.key === k);
          if (existing && existing.value !== String(v)) {
            existing.value = String(v);
            collChanged = true;
          } else if (!existing) {
            coll.variable.push({ key: k, value: String(v), type: 'string' });
            collChanged = true;
          }
        }
        if (collChanged) {
          this._storage.saveCollection(coll);
        }
      }
    }

    // 4. Resolve variables in URL, headers, auth, body
    const mergedVars = VariableResolver.mergeVariables({
      local: localVars,
      environment: envVars,
      collection: collVars
    });

    const finalUrl = VariableResolver.resolveUrl(request.url, mergedVars);
    const resolvedHeaders = VariableResolver.resolveHeaders(request.headers, mergedVars);
    const authHeaders = VariableResolver.resolveAuth(request.auth, mergedVars);
    Object.assign(resolvedHeaders, authHeaders);

    const { bodyData, contentType } = VariableResolver.resolveBody(request.body, mergedVars);
    if (contentType && !resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
      resolvedHeaders['Content-Type'] = contentType;
    }

    // Publish Outgoing Request logic
    addLog('info', `--> [REQUEST] ${request.method} ${finalUrl}`);
    if (Object.keys(resolvedHeaders).length > 0) {
      addLog('info', `[REQUEST HEADERS]\n${JSON.stringify(resolvedHeaders, null, 2)}`);
    }
    if (bodyData !== undefined && bodyData !== null && bodyData !== '') {
      const bodyStr = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData, null, 2);
      addLog('info', `[REQUEST BODY]\n${bodyStr}`);
    }

    // 5. Send HTTP/HTTPS request
    const responseResult = await HttpClient.send({
      url: finalUrl,
      method: request.method,
      headers: resolvedHeaders,
      body: bodyData,
      timeoutMs: settings.timeoutMs,
      rejectUnauthorizedSsl: settings.rejectUnauthorizedSsl,
      followRedirects: settings.followRedirects
    });

    // Publish Incoming Response logic
    const statusLevel = (responseResult.statusCode >= 200 && responseResult.statusCode < 400)
      ? 'info'
      : (responseResult.statusCode === 0 ? 'error' : 'warn');
    addLog(statusLevel, `<-- [RESPONSE] ${responseResult.statusCode} ${responseResult.statusText} (${responseResult.timeMs}ms, ${responseResult.sizeBytes} bytes)`);
    if (responseResult.headers && Object.keys(responseResult.headers).length > 0) {
      addLog('info', `[RESPONSE HEADERS]\n${JSON.stringify(responseResult.headers, null, 2)}`);
    }
    if (responseResult.body) {
      const bodyPreview = responseResult.body.length > 2500
        ? responseResult.body.substring(0, 2500) + `\n... [truncated, total ${responseResult.sizeBytes} bytes]`
        : responseResult.body;
      addLog('info', `[RESPONSE BODY]\n${bodyPreview}`);
    }

    // 6. Run Test/Post-request scripts (Collection-level + Request-level)
    let testResults: any[] = [];
    const collTestScript = coll?.event?.find(e => e.listen === 'test')?.script;
    if (collTestScript) {
      const scriptCode = Array.isArray(collTestScript.exec) ? collTestScript.exec.join('\n') : (collTestScript.exec || '');
      if (scriptCode.trim()) {
        const collTestExec = ScriptSandbox.runScript({
          scriptContent: scriptCode,
          stage: 'test',
          environmentVars: envVars,
          collectionVars: collVars,
          localVars: localVars,
          request: {
            url: finalUrl,
            method: request.method,
            headers: resolvedHeaders,
            body: bodyData
          },
          response: {
            code: responseResult.statusCode,
            status: responseResult.statusText,
            headers: responseResult.headers,
            body: responseResult.body,
            responseTime: responseResult.timeMs
          }
        });
        for (const l of collTestExec.logs) {
          logs.push(l);
          AltmanPanel.logOutput(l.level, `[SCRIPT:Collection-Test] ${l.message}`);
        }
        testResults.push(...collTestExec.testResults);
        envVars = collTestExec.mutatedEnvironment;
        collVars = collTestExec.mutatedCollectionVars;
        localVars = collTestExec.mutatedLocalVars;
      }
    }

    if (request.testScript && request.testScript.trim()) {
      const testExec = ScriptSandbox.runScript({
        scriptContent: request.testScript,
        stage: 'test',
        environmentVars: envVars,
        collectionVars: collVars,
        localVars: localVars,
        request: {
          url: finalUrl,
          method: request.method,
          headers: resolvedHeaders,
          body: bodyData
        },
        response: {
          code: responseResult.statusCode,
          status: responseResult.statusText,
          headers: responseResult.headers,
          body: responseResult.body,
          responseTime: responseResult.timeMs
        }
      });
      for (const l of testExec.logs) {
        logs.push(l);
        AltmanPanel.logOutput(l.level, `[SCRIPT:Test] ${l.message}`);
      }
      testResults.push(...testExec.testResults);
      envVars = testExec.mutatedEnvironment;
      collVars = testExec.mutatedCollectionVars;
      localVars = testExec.mutatedLocalVars;
    }

    if (testResults.length > 0) {
      for (const t of testResults) {
        addLog(t.passed ? 'info' : 'error', `[TEST] ${t.passed ? 'PASS ✓' : 'FAIL ✗'} ${t.name}${t.error ? ': ' + t.error : ''}`);
      }
    }

    // Persist mutated environment values after test scripts if modified
    if (activeEnv) {
      let changed = false;
      for (const [k, v] of Object.entries(envVars)) {
        const existing = activeEnv.values.find(ev => ev.key === k);
        if (existing && existing.value !== String(v)) {
          existing.value = String(v);
          changed = true;
        } else if (!existing) {
          activeEnv.values.push({ key: k, value: String(v), enabled: true });
          changed = true;
        }
      }
      if (changed) {
        this._storage.saveEnvironment(activeEnv);
        this._panel.webview.postMessage({
          type: 'environmentsUpdated',
          environments: this._storage.listEnvironments()
        });
      }
    }

    // Persist mutated collection variables after test scripts if modified
    if (coll) {
      let collChanged = false;
      if (!coll.variable) coll.variable = [];
      for (const [k, v] of Object.entries(collVars)) {
        const existing = coll.variable.find(cv => cv.key === k);
        if (existing && existing.value !== String(v)) {
          existing.value = String(v);
          collChanged = true;
        } else if (!existing) {
          coll.variable.push({ key: k, value: String(v), type: 'string' });
          collChanged = true;
        }
      }
      if (collChanged) {
        this._storage.saveCollection(coll);
        this._panel.webview.postMessage({
          type: 'collectionsUpdated',
          collections: this._storage.listCollections()
        });
      }
    }

    // 7. Save to local history
    const historyItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      method: request.method,
      url: finalUrl,
      statusCode: responseResult.statusCode,
      statusText: responseResult.statusText,
      timeMs: responseResult.timeMs,
      sizeBytes: responseResult.sizeBytes,
      collectionName: request.collectionName,
      requestName: request.requestName
    };
    this._storage.addHistory(historyItem);

    // 8. Send response back to Webview
    this._panel.webview.postMessage({
      type: 'requestExecuted',
      response: {
        ...responseResult,
        testResults,
        logs
      },
      history: this._storage.getHistory()
    });
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const monacoBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'monaco', 'vs'));
    const monacoLoaderUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'monaco', 'vs', 'loader.js'));
    const monacoCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'monaco', 'vs', 'editor', 'editor.main.css'));
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
    const swaggerCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'swagger-ui', 'swagger-ui.css'));
    const swaggerJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'swagger-ui', 'swagger-ui-bundle.js'));
    const swaggerPresetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'swagger-ui', 'swagger-ui-standalone-preset.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:; worker-src blob: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Altman Local HTTP Client</title>
  <link rel="stylesheet" href="${monacoCssUri}">
  <link rel="stylesheet" href="${swaggerCssUri}">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body class="altman-body">
  <div id="app">
    <!-- Top Bar -->
    <header class="top-nav">
      <div class="brand">
        <span class="brand-logo">⚡ Altman</span>
      </div>
      <div class="top-actions">
        <div class="env-selector-wrapper">
          <label for="envSelect">Environment:</label>
          <select id="envSelect" class="altman-select">
            <option value="">No Environment</option>
          </select>
          <button id="btnManageEnv" class="btn btn-secondary btn-icon" title="Manage Environments">⚙️</button>
        </div>
        <div class="view-mode-toggle">
          <button id="btnViewPostman" class="toggle-btn active" title="Postman Request & Testing View">⚡ Postman View</button>
          <button id="btnViewOpenApi" class="toggle-btn" title="OpenAPI 3.0 YAML View">📄 OpenAPI YAML View</button>
        </div>
        <button id="btnReloadFromDisk" class="btn btn-secondary" title="Reload collections & environments from local disk files">🔄 Reload</button>
        <button id="btnNewRequest" class="btn btn-primary" title="New Request">+ New</button>
        <button id="btnImportColl" class="btn btn-secondary" title="Import Postman Collection v2.1">Import</button>
        <button id="btnExportColl" class="btn btn-secondary" title="Export Postman Collection v2.1">Export</button>
        <button id="btnOpenNewman" class="btn btn-secondary" title="Compose Newman CLI Command">Newman</button>
        <button id="btnOpenCodeGen" class="btn btn-secondary" title="Generate Code Snippet">&lt;/&gt; Code</button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="workspace-layout">
      <!-- Left Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-tabs">
          <button class="sidebar-tab active" data-tab="collectionsTab">Collections</button>
          <button class="sidebar-tab" data-tab="environmentsTab">Environments</button>
          <button class="sidebar-tab" data-tab="historyTab">History</button>
        </div>

        <!-- Collections Panel -->
        <div id="collectionsTab" class="sidebar-content active">
          <div class="sidebar-actions">
            <button id="btnAddCollection" class="btn btn-sm btn-outline">+ Collection</button>
            <button id="btnRefreshCollections" class="btn btn-sm btn-outline" title="Refresh collections from disk">🔄</button>
          </div>
          <div id="collectionsList" class="tree-list">
            <!-- Dynamic tree items -->
          </div>
        </div>

        <!-- Environments Panel -->
        <div id="environmentsTab" class="sidebar-content">
          <div class="sidebar-actions">
            <button id="btnAddEnvironment" class="btn btn-sm btn-outline">+ Environment</button>
            <button id="btnRefreshEnvironments" class="btn btn-sm btn-outline" title="Refresh environments from disk">🔄</button>
          </div>
          <div id="environmentsList" class="tree-list"></div>
        </div>

        <!-- History Panel -->
        <div id="historyTab" class="sidebar-content">
          <div class="sidebar-actions">
            <button id="btnClearHistory" class="btn btn-sm btn-outline">Clear History</button>
          </div>
          <div id="historyList" class="tree-list"></div>
        </div>
      </aside>

      <!-- Center / Right Workbench -->
      <main class="workbench">
        <!-- Postman Workbench View Container -->
        <div id="postmanWorkbenchView" class="view-mode-container active">
          <!-- Postman-style Request Tabs -->
          <div class="workbench-tabs-bar" id="workbenchTabsBar">
            <div class="workbench-tabs-list" id="workbenchTabsList"></div>
            <button id="btnNewWorkbenchTab" class="btn-new-tab" title="New Request Tab">+</button>
          </div>

          <!-- Request Title Bar -->
          <div class="workbench-header">
          <input type="text" id="requestNameInput" class="request-name-input" value="Untitled Request" placeholder="Request Name" />
          <div class="collection-crumb" id="collectionCrumb">No Collection</div>
        </div>

        <!-- URL Bar -->
        <div class="url-bar">
          <select id="methodSelect" class="method-dropdown">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
          <input type="text" id="urlInput" class="url-input" placeholder="https://api.example.com/v1/resource/{{id}}" />
          <button id="btnSend" class="btn btn-primary btn-send">Send</button>
          <button id="btnSave" class="btn btn-secondary">Save</button>
        </div>

        <!-- Request Config Tabs -->
        <div class="request-tabs">
          <button class="req-tab active" data-panel="paramsPanel">Params</button>
          <button class="req-tab" data-panel="authPanel">Authorization</button>
          <button class="req-tab" data-panel="headersPanel">Headers <span id="headerCountBadge" class="badge">0</span></button>
          <button class="req-tab" data-panel="bodyPanel">Body</button>
          <button class="req-tab" data-panel="preScriptPanel">Pre-request Script</button>
          <button class="req-tab" data-panel="testScriptPanel">Tests</button>
        </div>

        <div class="req-panel-content">
          <!-- Params Panel -->
          <div id="paramsPanel" class="req-panel active">
            <div class="section-title">Query Parameters</div>
            <table class="kv-table" id="queryParamsTable">
              <thead>
                <tr>
                  <th width="30"></th>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th width="40"></th>
                </tr>
              </thead>
              <tbody id="queryParamsBody"></tbody>
            </table>
            <button id="btnAddQueryParam" class="btn btn-xs btn-outline">+ Add Query Param</button>
          </div>

          <!-- Auth Panel -->
          <div id="authPanel" class="req-panel">
            <div class="form-row">
              <label>Type:</label>
              <select id="authTypeSelect" class="altman-select">
                <option value="noauth">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
              </select>
            </div>
            <div id="authConfigFields" class="auth-config-fields"></div>
          </div>

          <!-- Headers Panel -->
          <div id="headersPanel" class="req-panel">
            <table class="kv-table" id="headersTable">
              <thead>
                <tr>
                  <th width="30"></th>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th width="40"></th>
                </tr>
              </thead>
              <tbody id="headersBody"></tbody>
            </table>
            <button id="btnAddHeader" class="btn btn-xs btn-outline">+ Add Header</button>
          </div>

          <!-- Body Panel -->
          <div id="bodyPanel" class="req-panel">
            <div class="body-mode-selector">
              <label><input type="radio" name="bodyMode" value="none" checked> none</label>
              <label><input type="radio" name="bodyMode" value="raw"> raw</label>
              <label><input type="radio" name="bodyMode" value="urlencoded"> x-www-form-urlencoded</label>
            </div>
            <div id="rawBodyOptions" class="raw-options hidden">
              <select id="rawLanguageSelect" class="altman-select">
                <option value="json">JSON</option>
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="xml">XML</option>
              </select>
              <button id="btnBeautifyBody" class="btn btn-xs btn-outline">Format JSON</button>
            </div>
            <div id="rawEditorContainer" class="body-editor-wrap hidden">
              <textarea id="rawBodyTextarea" class="code-editor" placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}"></textarea>
            </div>
            <div id="urlencodedContainer" class="body-editor-wrap hidden">
              <table class="kv-table" id="urlEncodedTable">
                <thead><tr><th width="30"></th><th>Key</th><th>Value</th><th width="40"></th></tr></thead>
                <tbody id="urlEncodedBody"></tbody>
              </table>
              <button id="btnAddUrlEncoded" class="btn btn-xs btn-outline">+ Add Key-Value</button>
            </div>
          </div>

          <!-- Pre-request Script Panel -->
          <div id="preScriptPanel" class="req-panel">
            <div class="script-tips">
              Bundled with <code>jsrsasign</code>, <code>CryptoJS</code>, <code>lodash</code>, <code>moment</code>, and <code>pm.*</code> sandbox API.
            </div>
            <div id="preScriptMonacoContainer" class="monaco-editor-host"></div>
            <textarea id="preScriptEditor" class="code-editor" style="display:none;"></textarea>
          </div>

          <!-- Test Script Panel -->
          <div id="testScriptPanel" class="req-panel">
            <div class="script-tips">
              Write assertions using <code>pm.test(&quot;name&quot;, function() { pm.expect(pm.response.code).to.equal(200); })</code>
            </div>
            <div id="testScriptMonacoContainer" class="monaco-editor-host"></div>
            <textarea id="testScriptEditor" class="code-editor" style="display:none;"></textarea>
          </div>
        </div>

        <!-- Response Inspector Panel -->
        <div class="response-panel">
          <div class="response-header">
            <div class="resp-tabs">
              <button class="resp-tab active" data-resp-panel="respBodyPanel">Body</button>
              <button class="resp-tab" data-resp-panel="respHeadersPanel">Headers <span id="respHeaderBadge" class="badge">0</span></button>
              <button class="resp-tab" data-resp-panel="respCookiesPanel">Cookies <span id="respCookieBadge" class="badge">0</span></button>
              <button class="resp-tab" data-resp-panel="respTestsPanel">Test Results <span id="respTestsBadge" class="badge">0/0</span></button>
              <button class="resp-tab" data-resp-panel="respLogsPanel">Console Logs <span id="respLogsBadge" class="badge">0</span></button>
            </div>
            <div class="response-metrics" id="responseMetrics">
              <span id="metricStatus" class="metric-pill">Status: --</span>
              <span id="metricTime" class="metric-pill">Time: -- ms</span>
              <span id="metricSize" class="metric-pill">Size: -- B</span>
            </div>
          </div>

          <div class="resp-content">
            <div id="respBodyPanel" class="resp-subpanel active">
              <div class="resp-body-actions">
                <button id="btnCopyResp" class="btn btn-xs btn-outline">Copy</button>
              </div>
              <pre id="responseBodyViewer" class="code-viewer">Send a request to see the response here.</pre>
            </div>
            <div id="respHeadersPanel" class="resp-subpanel">
              <table class="kv-table" id="responseHeadersTable">
                <thead><tr><th>Header</th><th>Value</th></tr></thead>
                <tbody id="responseHeadersBody"></tbody>
              </table>
            </div>
            <div id="respCookiesPanel" class="resp-subpanel">
              <table class="kv-table" id="responseCookiesTable">
                <thead><tr><th>Name</th><th>Value</th></tr></thead>
                <tbody id="responseCookiesBody"></tbody>
              </table>
            </div>
            <div id="respTestsPanel" class="resp-subpanel">
              <div id="testResultsList" class="test-results-container">
                <div class="placeholder-text">No tests executed yet.</div>
              </div>
            </div>
            <div id="respLogsPanel" class="resp-subpanel">
              <div id="consoleLogsList" class="console-logs-container">
                <div class="placeholder-text">No script console logs yet.</div>
              </div>
            </div>
          </div>
        </div>
        </div><!-- End of postmanWorkbenchView -->

        <!-- OpenAPI YAML & Swagger UI Split View Container -->
        <div id="openApiWorkbenchView" class="view-mode-container hidden">
          <div class="openapi-header">
            <div class="openapi-info">
              <span class="openapi-title">📄 OpenAPI 3.0.3 & Swagger UI</span>
            </div>
            <div class="openapi-actions">
              <label for="openApiCollSelect">Collection:</label>
              <select id="openApiCollSelect" class="altman-select"></select>
              <button id="btnRefreshOpenApi" class="btn btn-secondary">🔄 Refresh</button>
              <button id="btnCopyOpenApi" class="btn btn-secondary">📋 Copy YAML</button>
              <button id="btnExportOpenApi" class="btn btn-primary">💾 Export YAML File</button>
            </div>
          </div>
          <!-- Side-by-Side Split View -->
          <div class="openapi-split-view">
            <!-- Left Pane: YAML Source -->
            <div class="openapi-pane openapi-yaml-pane">
              <div class="pane-header">
                <span class="pane-title">📄 OpenAPI YAML Source</span>
                <span class="pane-badge">v3.0.3 Spec</span>
              </div>
              <div class="openapi-content">
                <pre id="openApiYamlViewer" class="code-viewer openapi-viewer">Loading OpenAPI specification...</pre>
              </div>
            </div>

            <!-- Right Pane: Interactive Swagger UI -->
            <div class="openapi-pane openapi-swagger-pane">
              <div class="pane-header">
                <span class="pane-title">⚡ Interactive Swagger UI</span>
              </div>
              <div class="swagger-content-wrap">
                <div id="swaggerUiContainer"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Modals -->
    <!-- Code Gen Modal -->
    <div id="codeGenModal" class="modal-overlay hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Generate Code Snippet</h3>
          <button class="modal-close" id="btnCloseCodeGen">&times;</button>
        </div>
        <div class="modal-tabs">
          <button class="code-tab active" data-lang="curl">cURL</button>
          <button class="code-tab" data-lang="node">Node.js (Fetch)</button>
          <button class="code-tab" data-lang="python">Python (Requests)</button>
          <button class="code-tab" data-lang="java">Java (HttpClient)</button>
        </div>
        <pre id="codeSnippetViewer" class="modal-code-viewer"></pre>
        <div class="modal-footer">
          <button id="btnCopySnippet" class="btn btn-primary">Copy Code</button>
        </div>
      </div>
    </div>

    <!-- Newman Modal -->
    <div id="newmanModal" class="modal-overlay hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Newman CLI Command Composer</h3>
          <button class="modal-close" id="btnCloseNewman">&times;</button>
        </div>
        <div class="modal-body form-grid">
          <label>Collection:</label>
          <select id="newmanCollectionSelect" class="altman-select"></select>

          <label>Environment:</label>
          <select id="newmanEnvSelect" class="altman-select">
            <option value="">(None)</option>
          </select>

          <label>Iterations:</label>
          <input type="number" id="newmanIterations" class="altman-input" value="1" min="1" />

          <label>Options:</label>
          <div class="checkbox-group">
            <label><input type="checkbox" id="newmanInsecure" checked /> Insecure SSL (--insecure)</label>
            <label><input type="checkbox" id="newmanBail" /> Bail on failure (--bail)</label>
          </div>

          <label>Command Preview:</label>
          <textarea id="newmanCommandPreview" class="code-editor" readonly rows="3"></textarea>
        </div>
        <div class="modal-footer">
          <button id="btnCopyNewman" class="btn btn-secondary">Copy Command</button>
          <button id="btnRunNewmanTerminal" class="btn btn-primary">▶ Run in VS Code Terminal</button>
        </div>
      </div>
    </div>

    <!-- Environment Manager Modal -->
    <div id="envManagerModal" class="modal-overlay hidden">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="envModalTitle">Manage Environment</h3>
          <button class="modal-close" id="btnCloseEnvModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Name:</label>
            <input type="text" id="envNameInput" class="altman-input" placeholder="e.g. Local Development" />
          </div>
          <table class="kv-table" id="envVariablesTable">
            <thead>
              <tr>
                <th width="30"></th>
                <th>Variable Name</th>
                <th>Initial / Current Value</th>
                <th width="40"></th>
              </tr>
            </thead>
            <tbody id="envVariablesBody"></tbody>
          </table>
          <button id="btnAddEnvVar" class="btn btn-xs btn-outline">+ Add Variable</button>
        </div>
        <div class="modal-footer">
          <button id="btnSaveEnvModal" class="btn btn-primary">Save Environment</button>
        </div>
      </div>
    </div>

    <!-- Collection Manager Modal (Variables & Scripts) -->
    <div id="collManagerModal" class="modal-overlay hidden">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="collModalTitle">Collection Settings</h3>
          <button class="modal-close" id="btnCloseCollModal">&times;</button>
        </div>
        <div class="modal-tabs">
          <button class="code-tab active" data-coll-tab="collVarsTab">Variables</button>
          <button class="code-tab" data-coll-tab="collPreScriptTab">Pre-request Script</button>
          <button class="code-tab" data-coll-tab="collTestScriptTab">Tests</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Name:</label>
            <input type="text" id="collNameInput" class="altman-input" style="flex:1;" />
          </div>
          <!-- Variables Tab -->
          <div id="collVarsTab" class="coll-modal-tab-content">
            <table class="kv-table" id="collVariablesTable">
              <thead>
                <tr>
                  <th width="30"></th>
                  <th>Variable Name</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th width="40"></th>
                </tr>
              </thead>
              <tbody id="collVariablesBody"></tbody>
            </table>
            <button id="btnAddCollVar" class="btn btn-xs btn-outline">+ Add Collection Variable</button>
          </div>
          <!-- Pre-request Script Tab -->
          <div id="collPreScriptTab" class="coll-modal-tab-content hidden">
            <div class="script-tips">Runs before every request in this collection. Bundled with <code>jsrsasign</code>, <code>lodash</code>, <code>moment</code>, and <code>pm.*</code></div>
            <div id="collPreScriptMonacoContainer" class="monaco-editor-host"></div>
            <textarea id="collPreScriptEditor" class="code-editor" style="display:none;"></textarea>
          </div>
          <!-- Tests Tab -->
          <div id="collTestScriptTab" class="coll-modal-tab-content hidden">
            <div class="script-tips">Runs after every request in this collection.</div>
            <div id="collTestScriptMonacoContainer" class="monaco-editor-host"></div>
            <textarea id="collTestScriptEditor" class="code-editor" style="display:none;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btnDeleteCollInModal" class="btn btn-secondary" style="color:#eb4d4b; margin-right: auto;">Delete Collection</button>
          <button id="btnSaveCollModal" class="btn btn-primary">Save Collection</button>
        </div>
      </div>
    </div>

    <!-- New Collection Modal (replaces window.prompt) -->
    <div id="newCollModal" class="modal-overlay hidden">
      <div class="modal-content" style="width: 400px;">
        <div class="modal-header">
          <h3>Create New Collection</h3>
          <button class="modal-close" id="btnCloseNewCollModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row" style="margin-top: 8px;">
            <input type="text" id="newCollNameInput" class="altman-input" style="width:100%;" placeholder="e.g. Payments API" />
          </div>
        </div>
        <div class="modal-footer">
          <button id="btnSubmitNewColl" class="btn btn-primary">Create</button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal (replaces window.confirm) -->
    <div id="confirmDialogModal" class="modal-overlay hidden">
      <div class="modal-content" style="width: 420px;">
        <div class="modal-header">
          <h3 id="confirmDialogTitle">Confirm Action</h3>
          <button class="modal-close" id="btnCloseConfirmDialog">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmDialogMessage" style="padding: 12px 0; font-size: 13px;"></p>
        </div>
        <div class="modal-footer">
          <button id="btnCancelConfirmDialog" class="btn btn-secondary">Cancel</button>
          <button id="btnProceedConfirmDialog" class="btn btn-primary" style="background:#eb4d4b;">Delete</button>
        </div>
      </div>
    </div>

  </div>

  <script nonce="${nonce}">
    window.monacoBaseUri = "${monacoBaseUri}";
    window.monacoNonce = "${nonce}";
  </script>
  <script nonce="${nonce}" src="${monacoLoaderUri}"></script>
  <script nonce="${nonce}" src="${swaggerJsUri}"></script>
  <script nonce="${nonce}" src="${swaggerPresetUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
