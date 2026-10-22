import * as vscode from 'vscode';
import { AltmanStorage } from '../storage/altmanStorage';
import { AltmanPanel } from './altmanPanel';
import { OpenApiConverter } from '../engine/openapiConverter';

export class AltmanSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'altman.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storage: AltmanStorage
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'getSidebarData': {
          this.refresh();
          break;
        }

        case 'openWorkbench': {
          vscode.commands.executeCommand('altman.openClient');
          break;
        }

        case 'openRequestInWorkbench': {
          AltmanPanel.createOrShow(this._extensionUri, this._storage);
          // Wait briefly for webview to be ready, then tell it to load request
          setTimeout(() => {
            if (AltmanPanel.currentPanel) {
              AltmanPanel.currentPanel.loadSpecificRequest(message.collectionName, message.requestName);
            }
          }, 300);
          break;
        }

        case 'newRequest': {
          vscode.commands.executeCommand('altman.newRequest');
          break;
        }

        case 'importCollection': {
          vscode.commands.executeCommand('altman.importCollection');
          break;
        }

        case 'exportOpenApi': {
          vscode.commands.executeCommand('altman.exportOpenApi');
          break;
        }

        case 'setActiveEnvironment': {
          this._storage.saveSettings({ activeEnvironmentName: message.name });
          vscode.commands.executeCommand('altman.refreshAllViews');
          break;
        }
      }
    });
  }

  public refresh(): void {
    if (this._view) {
      const collections = this._storage.listCollections();
      const environments = this._storage.listEnvironments();
      const settings = this._storage.getSettings();

      this._view.webview.postMessage({
        type: 'sidebarData',
        data: {
          collections,
          environments,
          activeEnvironmentName: settings.activeEnvironmentName || ''
        }
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <style>
    body {
      padding: 10px;
      font-size: 12px;
      background-color: var(--vscode-sideBar-background);
      overflow-y: auto;
    }
    .sidebar-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn-launch {
      width: 100%;
      padding: 8px 12px;
      font-weight: 700;
      font-size: 12px;
      background-color: #ff6c37;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .btn-launch:hover {
      background-color: #ff5722;
    }
    .quick-toolbar {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .quick-toolbar .btn {
      flex: 1;
      padding: 4px 6px;
      font-size: 11px;
      text-align: center;
    }
    .section-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sidebar-tree-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sidebar-tree-node {
      padding: 5px 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
      font-size: 12px;
    }
    .sidebar-tree-node:hover {
      background-color: var(--bg-tertiary);
    }
    .sidebar-tree-node .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidebar-folder-items {
      margin-left: 10px;
      border-left: 1px solid var(--border-color);
      padding-left: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  </style>
</head>
<body>
  <div class="sidebar-container">
    <!-- Big Launch Workbench Button -->
    <button id="btnOpenWorkbench" class="btn-launch">
      <span>⚡ Open Altman Workbench</span>
    </button>

    <!-- Quick Action Bar -->
    <div class="quick-toolbar">
      <button id="btnSidebarNew" class="btn btn-secondary">+ Request</button>
      <button id="btnSidebarImport" class="btn btn-secondary">Import</button>
      <button id="btnSidebarOpenApi" class="btn btn-secondary" title="Export OpenAPI 3.0 YAML">OpenAPI</button>
    </div>

    <!-- Active Environment Selector -->
    <div>
      <div class="section-header">
        <span>Environment</span>
      </div>
      <select id="sidebarEnvSelect" class="altman-select" style="width: 100%; margin-top: 4px;">
        <option value="">(No Environment)</option>
      </select>
    </div>

    <!-- Collections List -->
    <div>
      <div class="section-header">
        <span>Collections</span>
      </div>
      <div id="sidebarCollectionsList" class="sidebar-tree-list" style="margin-top: 6px;">
        <div class="placeholder-text">Loading collections...</div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const btnOpenWorkbench = document.getElementById('btnOpenWorkbench');
    const btnSidebarNew = document.getElementById('btnSidebarNew');
    const btnSidebarImport = document.getElementById('btnSidebarImport');
    const btnSidebarOpenApi = document.getElementById('btnSidebarOpenApi');
    const sidebarEnvSelect = document.getElementById('sidebarEnvSelect');
    const sidebarCollectionsList = document.getElementById('sidebarCollectionsList');

    btnOpenWorkbench.addEventListener('click', () => {
      vscode.postMessage({ type: 'openWorkbench' });
    });

    btnSidebarNew.addEventListener('click', () => {
      vscode.postMessage({ type: 'newRequest' });
    });

    btnSidebarImport.addEventListener('click', () => {
      vscode.postMessage({ type: 'importCollection' });
    });

    btnSidebarOpenApi.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportOpenApi' });
    });

    sidebarEnvSelect.addEventListener('change', () => {
      vscode.postMessage({ type: 'setActiveEnvironment', name: sidebarEnvSelect.value });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'sidebarData') {
        renderSidebar(msg.data);
      }
    });

    function renderSidebar(data) {
      // Environments
      sidebarEnvSelect.innerHTML = '<option value="">(No Environment)</option>';
      for (const env of data.environments || []) {
        const opt = document.createElement('option');
        opt.value = env.name;
        opt.textContent = env.name;
        if (env.name === data.activeEnvironmentName) opt.selected = true;
        sidebarEnvSelect.appendChild(opt);
      }

      // Collections
      sidebarCollectionsList.innerHTML = '';
      const colls = data.collections || [];
      if (colls.length === 0) {
        sidebarCollectionsList.innerHTML = '<div class="placeholder-text">No collections in .altman. Click Import to add.</div>';
        return;
      }

      for (const c of colls) {
        const collNode = document.createElement('div');
        collNode.className = 'sidebar-tree-node';
        collNode.style.fontWeight = '600';
        collNode.innerHTML = '<span style="color:#ff6c37;">📁</span> <span class="name">' + escapeHtml(c.info.name) + '</span>';
        collNode.addEventListener('click', () => {
          vscode.postMessage({ type: 'openWorkbench' });
        });
        sidebarCollectionsList.appendChild(collNode);

        const subContainer = document.createElement('div');
        subContainer.className = 'sidebar-folder-items';
        renderItems(c.item || [], subContainer, c.info.name);
        sidebarCollectionsList.appendChild(subContainer);
      }
    }

    function renderItems(items, container, collName) {
      for (const it of items) {
        if (Array.isArray(it.item)) {
          const folderNode = document.createElement('div');
          folderNode.className = 'sidebar-tree-node';
          folderNode.innerHTML = '<span>📂</span> <span class="name">' + escapeHtml(it.name) + '</span>';
          container.appendChild(folderNode);

          const sub = document.createElement('div');
          sub.className = 'sidebar-folder-items';
          renderItems(it.item, sub, collName);
          container.appendChild(sub);
        } else if (it.request) {
          const reqNode = document.createElement('div');
          reqNode.className = 'sidebar-tree-node';
          const method = it.request.method || 'GET';
          reqNode.innerHTML = '<span class="badge-method ' + method + '">' + method + '</span> <span class="name">' + escapeHtml(it.name) + '</span>';
          reqNode.addEventListener('click', () => {
            vscode.postMessage({
              type: 'openRequestInWorkbench',
              collectionName: collName,
              requestName: it.name
            });
          });
          container.appendChild(reqNode);
        }
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Request initial data
    vscode.postMessage({ type: 'getSidebarData' });
  </script>
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
