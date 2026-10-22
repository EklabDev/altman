import type * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PostmanCollection, PostmanEnvironment, RequestHistoryItem } from '../types';

export interface AltmanSettings {
  timeoutMs: number;
  rejectUnauthorizedSsl: boolean;
  followRedirects: boolean;
  activeEnvironmentName?: string;
}

export class AltmanStorage {
  private baseDir: string;

  constructor(workspaceUri?: vscode.Uri) {
    if (workspaceUri) {
      this.baseDir = path.join(workspaceUri.fsPath, '.altman');
    } else {
      this.baseDir = path.join(os.homedir(), '.altman');
    }
    this.ensureDirs();
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  private ensureDirs(): void {
    const dirs = [
      this.baseDir,
      path.join(this.baseDir, 'collections'),
      path.join(this.baseDir, 'environments'),
      path.join(this.baseDir, 'history')
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }
  }

  // --- Collections ---
  public listCollections(): PostmanCollection[] {
    const collDir = path.join(this.baseDir, 'collections');
    if (!fs.existsSync(collDir)) {
      return [];
    }
    const files = fs.readdirSync(collDir).filter(f => f.endsWith('.json'));
    const results: PostmanCollection[] = [];
    for (const f of files) {
      try {
        const fullPath = path.join(collDir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content) as PostmanCollection;
        if (parsed.info && parsed.info.name) {
          results.push(parsed);
        }
      } catch (err) {
        console.error(`Failed to parse collection ${f}:`, err);
      }
    }
    return results;
  }

  public getCollection(name: string): PostmanCollection | undefined {
    return this.listCollections().find(c => c.info.name === name);
  }

  public saveCollection(collection: PostmanCollection): string {
    this.ensureDirs();
    const safeName = (collection.info.name || 'Untitled')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim();
    const filePath = path.join(this.baseDir, 'collections', `${safeName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
    return filePath;
  }

  public deleteCollection(name: string): boolean {
    const collDir = path.join(this.baseDir, 'collections');
    if (!fs.existsSync(collDir)) {
      return false;
    }
    let deleted = false;
    const files = fs.readdirSync(collDir).filter(f => f.endsWith('.json'));
    const target = name.trim().toLowerCase();
    for (const f of files) {
      try {
        const fullPath = path.join(collDir, f);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed.info && (parsed.info.name === name || (parsed.info.name && parsed.info.name.trim().toLowerCase() === target))) {
          fs.unlinkSync(fullPath);
          deleted = true;
        }
      } catch (err) {}
    }
    // Fallback to safeName
    const safeName = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const fallbackPath = path.join(collDir, `${safeName}.json`);
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath);
      deleted = true;
    }
    return deleted;
  }

  // --- Environments ---
  public listEnvironments(): PostmanEnvironment[] {
    const envDir = path.join(this.baseDir, 'environments');
    if (!fs.existsSync(envDir)) {
      return [];
    }
    const files = fs.readdirSync(envDir).filter(f => f.endsWith('.json'));
    const results: PostmanEnvironment[] = [];
    for (const f of files) {
      try {
        const fullPath = path.join(envDir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content) as PostmanEnvironment;
        if (parsed.name && Array.isArray(parsed.values)) {
          results.push(parsed);
        }
      } catch (err) {
        console.error(`Failed to parse environment ${f}:`, err);
      }
    }
    return results;
  }

  public getEnvironment(name: string): PostmanEnvironment | undefined {
    return this.listEnvironments().find(e => e.name === name);
  }

  public saveEnvironment(env: PostmanEnvironment): string {
    this.ensureDirs();
    const safeName = (env.name || 'Untitled')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim();
    const filePath = path.join(this.baseDir, 'environments', `${safeName}.altman_env.json`);
    fs.writeFileSync(filePath, JSON.stringify(env, null, 2), 'utf8');
    return filePath;
  }

  public deleteEnvironment(name: string): boolean {
    const envDir = path.join(this.baseDir, 'environments');
    if (!fs.existsSync(envDir)) {
      return false;
    }
    let deleted = false;
    const files = fs.readdirSync(envDir).filter(f => f.endsWith('.json'));
    const target = name.trim().toLowerCase();
    for (const f of files) {
      try {
        const fullPath = path.join(envDir, f);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed.name === name || (parsed.name && parsed.name.trim().toLowerCase() === target)) {
          fs.unlinkSync(fullPath);
          deleted = true;
        }
      } catch (err) {}
    }
    // Fallback to safeName
    const safeName = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const fallbackPath = path.join(envDir, `${safeName}.altman_env.json`);
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath);
      deleted = true;
    }
    return deleted;
  }

  // --- Settings ---
  public getSettings(): AltmanSettings {
    const sPath = path.join(this.baseDir, 'settings.json');
    const defaults: AltmanSettings = {
      timeoutMs: 30000,
      rejectUnauthorizedSsl: false, // Default false for local dev / self-signed certs
      followRedirects: true,
      activeEnvironmentName: undefined
    };
    if (fs.existsSync(sPath)) {
      try {
        const raw = fs.readFileSync(sPath, 'utf8');
        return { ...defaults, ...JSON.parse(raw) };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  }

  public saveSettings(settings: Partial<AltmanSettings>): void {
    this.ensureDirs();
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    const sPath = path.join(this.baseDir, 'settings.json');
    fs.writeFileSync(sPath, JSON.stringify(updated, null, 2), 'utf8');
  }

  // --- History ---
  public getHistory(): RequestHistoryItem[] {
    const hPath = path.join(this.baseDir, 'history', 'request_history.json');
    if (fs.existsSync(hPath)) {
      try {
        const raw = fs.readFileSync(hPath, 'utf8');
        return JSON.parse(raw) as RequestHistoryItem[];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  public addHistory(item: RequestHistoryItem): void {
    this.ensureDirs();
    const hPath = path.join(this.baseDir, 'history', 'request_history.json');
    const list = this.getHistory();
    list.unshift(item);
    // Keep max 200 items locally
    const trimmed = list.slice(0, 200);
    fs.writeFileSync(hPath, JSON.stringify(trimmed, null, 2), 'utf8');
  }

  public clearHistory(): void {
    const hPath = path.join(this.baseDir, 'history', 'request_history.json');
    if (fs.existsSync(hPath)) {
      fs.writeFileSync(hPath, '[]', 'utf8');
    }
  }

  // --- Import / Export Helpers ---
  public importCollectionFromFile(sourceFilePath: string): PostmanCollection {
    const content = fs.readFileSync(sourceFilePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.info || !parsed.info.name) {
      throw new Error('Invalid Postman Collection file format.');
    }
    this.saveCollection(parsed);
    return parsed;
  }

  public exportCollectionToFile(collectionName: string, targetFilePath: string): void {
    const coll = this.getCollection(collectionName);
    if (!coll) {
      throw new Error(`Collection '${collectionName}' not found.`);
    }
    fs.writeFileSync(targetFilePath, JSON.stringify(coll, null, 2), 'utf8');
  }
}
