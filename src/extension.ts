import * as vscode from 'vscode';
import * as fs from 'fs';
import { AltmanStorage } from './storage/altmanStorage';
import { AltmanPanel } from './panels/altmanPanel';
import { AltmanSidebarViewProvider } from './panels/altmanSidebarView';
import { OpenApiConverter } from './engine/openapiConverter';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const workspaceUri = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.workspace.workspaceFolders[0].uri
    : undefined;

  const storage = new AltmanStorage(workspaceUri);

  // Register Activity Bar Sidebar Webview Provider
  const sidebarProvider = new AltmanSidebarViewProvider(context.extensionUri, storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AltmanSidebarViewProvider.viewType, sidebarProvider)
  );

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'altman.openClient';
  updateStatusBar(storage);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Command: Refresh All Views
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.refreshAllViews', () => {
      sidebarProvider.refresh();
      updateStatusBar(storage);
    })
  );

  // Command: Open Client
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.openClient', () => {
      AltmanPanel.createOrShow(context.extensionUri, storage);
      updateStatusBar(storage);
      sidebarProvider.refresh();
    })
  );

  // Command: New Request
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.newRequest', () => {
      AltmanPanel.createOrShow(context.extensionUri, storage);
    })
  );

  // Command: Import Postman Collection (handles right click context on .json file too)
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.importCollection', async (uri?: vscode.Uri) => {
      try {
        let filePath = uri?.fsPath;
        if (!filePath) {
          const selected = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Postman Collection v2.1': ['json'] },
            title: 'Select Postman Collection v2.1 JSON'
          });
          if (selected && selected[0]) {
            filePath = selected[0].fsPath;
          }
        }

        if (filePath) {
          const parsed = storage.importCollectionFromFile(filePath);
          sidebarProvider.refresh();
          const openAction = 'Open Altman Client';
          const choice = await vscode.window.showInformationMessage(
            `Imported collection "${parsed.info.name}" to .altman/collections`,
            openAction
          );
          if (choice === openAction) {
            AltmanPanel.createOrShow(context.extensionUri, storage);
          }
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to import collection: ${err.message}`);
      }
    })
  );

  // Command: Export Collection
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.exportCollection', async () => {
      try {
        const collections = storage.listCollections();
        if (collections.length === 0) {
          vscode.window.showWarningMessage('No collections found in .altman/collections to export.');
          return;
        }

        const picked = await vscode.window.showQuickPick(
          collections.map(c => c.info.name),
          { placeHolder: 'Select a collection to export' }
        );

        if (picked) {
          const targetUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${picked}.postman_collection.json`),
            filters: { 'Postman Collection v2.1': ['json'] }
          });
          if (targetUri) {
            storage.exportCollectionToFile(picked, targetUri.fsPath);
            vscode.window.showInformationMessage(`Collection exported to ${targetUri.fsPath}`);
          }
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export failed: ${err.message}`);
      }
    })
  );

  // Command: Export OpenAPI 3.0 YAML
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.exportOpenApi', async () => {
      try {
        const collections = storage.listCollections();
        if (collections.length === 0) {
          vscode.window.showWarningMessage('No collections found in .altman/collections to export.');
          return;
        }

        const picked = await vscode.window.showQuickPick(
          collections.map(c => c.info.name),
          { placeHolder: 'Select a collection to convert to OpenAPI 3.0 YAML' }
        );

        if (picked) {
          const coll = storage.getCollection(picked);
          if (!coll) return;

          const settings = storage.getSettings();
          let baseUrl = 'https://api.example.com';
          if (settings.activeEnvironmentName) {
            const env = storage.getEnvironment(settings.activeEnvironmentName);
            const b = env?.values.find(v => v.key === 'baseUrl' || v.key === 'host');
            if (b && b.value) baseUrl = b.value;
          }

          const yamlString = OpenApiConverter.toYaml(coll, { baseUrl });
          const targetUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${picked}.openapi.yaml`),
            filters: { 'OpenAPI 3.0 YAML': ['yaml', 'yml'] },
            title: 'Export OpenAPI 3.0 YAML'
          });

          if (targetUri) {
            fs.writeFileSync(targetUri.fsPath, yamlString, 'utf8');
            vscode.window.showInformationMessage(`Exported OpenAPI 3.0 YAML to ${targetUri.fsPath}`);
          }
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`OpenAPI export failed: ${err.message}`);
      }
    })
  );

  // Command: Run Newman
  context.subscriptions.push(
    vscode.commands.registerCommand('altman.runNewman', () => {
      AltmanPanel.createOrShow(context.extensionUri, storage);
    })
  );
}

function updateStatusBar(storage: AltmanStorage) {
  const settings = storage.getSettings();
  const envName = settings.activeEnvironmentName || 'No Env';
  statusBarItem.text = `$(radio-tower) Altman (${envName})`;
  statusBarItem.tooltip = `Altman Offline API Client - Active Environment: ${envName}`;
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
