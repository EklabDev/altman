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
    const results: { coll: PostmanCollection; mtime: number }[] = [];
    for (const f of files) {
      try {
        const fullPath = path.join(collDir, f);
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content) as PostmanCollection;
        if (parsed.info && parsed.info.name) {
          const parsedId = parsed.info._postman_id || (parsed.info as any).id;
          const parsedName = parsed.info.name.trim().toLowerCase();
          const parsedNameNorm = parsedName.replace(/_/g, ' ');

          // Deduplicate so collections with same ID or same name do not appear twice
          const existingIdx = results.findIndex(r => {
            const rId = r.coll.info._postman_id || (r.coll.info as any).id;
            const rName = r.coll.info.name.trim().toLowerCase();
            const rNameNorm = rName.replace(/_/g, ' ');
            if (parsedId && rId && parsedId === rId) return true;
            if (parsedName === rName || parsedNameNorm === rNameNorm) return true;
            return false;
          });

          if (existingIdx >= 0) {
            // Keep the newer file by modified time
            if (stat.mtimeMs > results[existingIdx].mtime) {
              results[existingIdx] = { coll: parsed, mtime: stat.mtimeMs };
            }
          } else {
            results.push({ coll: parsed, mtime: stat.mtimeMs });
          }
        }
      } catch (err) {
        console.error(`Failed to parse collection ${f}:`, err);
      }
    }
    return results.map(r => r.coll);
  }

  public getCollection(name: string): PostmanCollection | undefined {
    const target = name.trim().toLowerCase();
    const targetNorm = target.replace(/_/g, ' ');
    return this.listCollections().find(c => {
      const cName = c.info.name.trim().toLowerCase();
      return cName === target || cName.replace(/_/g, ' ') === targetNorm;
    });
  }

  public saveCollection(collection: PostmanCollection, originalName?: string): string {
    this.ensureDirs();
    const collDir = path.join(this.baseDir, 'collections');
    const safeName = (collection.info.name || 'Untitled')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim();
    const standardFilePath = path.join(collDir, `${safeName}.json`);

    // Look for existing files for this collection (by ID or original/current name)
    const files = fs.existsSync(collDir) ? fs.readdirSync(collDir).filter(f => f.endsWith('.json')) : [];
    const lookupNames = new Set<string>();
    if (originalName) {
      const o = originalName.trim().toLowerCase();
      lookupNames.add(o);
      lookupNames.add(o.replace(/_/g, ' '));
      lookupNames.add(o.replace(/\s+/g, '_'));
    }
    if (collection.info?.name) {
      const c = collection.info.name.trim().toLowerCase();
      lookupNames.add(c);
      lookupNames.add(c.replace(/_/g, ' '));
      lookupNames.add(c.replace(/\s+/g, '_'));
    }

    const postmanId = collection.info?._postman_id || (collection.info as any)?.id;
    const matchingFiles: string[] = [];

    for (const f of files) {
      try {
        const fullPath = path.join(collDir, f);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const fileId = parsed.info?._postman_id || (parsed.info as any)?.id;
        const rawFileName = parsed.info?.name?.trim().toLowerCase();
        const normFileName = rawFileName ? rawFileName.replace(/_/g, ' ') : '';
        const snakeFileName = rawFileName ? rawFileName.replace(/\s+/g, '_') : '';

        const idMatches = !!(postmanId && fileId && postmanId === fileId);
        const nameMatches = !!(
          (rawFileName && lookupNames.has(rawFileName)) ||
          (normFileName && lookupNames.has(normFileName)) ||
          (snakeFileName && lookupNames.has(snakeFileName))
        );

        if (idMatches || nameMatches) {
          matchingFiles.push(fullPath);
        }
      } catch (err) {}
    }

    // Overwrite standardFilePath; remove any stale duplicates with different names
    for (const matchPath of matchingFiles) {
      if (matchPath !== standardFilePath && fs.existsSync(matchPath)) {
        try {
          fs.unlinkSync(matchPath);
        } catch (e) {}
      }
    }

    fs.writeFileSync(standardFilePath, JSON.stringify(collection, null, 2), 'utf8');
    return standardFilePath;
  }

  public deleteCollection(name: string): boolean {
    const collDir = path.join(this.baseDir, 'collections');
    if (!fs.existsSync(collDir)) {
      return false;
    }
    let deleted = false;
    const files = fs.readdirSync(collDir).filter(f => f.endsWith('.json'));
    const target = name.trim().toLowerCase();
    const targetNorm = target.replace(/_/g, ' ');
    const targetSnake = target.replace(/\s+/g, '_');
    for (const f of files) {
      try {
        const fullPath = path.join(collDir, f);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const pName = parsed.info?.name ? parsed.info.name.trim().toLowerCase() : '';
        if (pName === target || pName.replace(/_/g, ' ') === targetNorm || pName.replace(/\s+/g, '_') === targetSnake) {
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
          const parsedName = parsed.name.trim().toLowerCase();
          const existingIdx = results.findIndex(e => e.name.trim().toLowerCase() === parsedName);
          if (existingIdx >= 0) {
            results[existingIdx] = parsed;
          } else {
            results.push(parsed);
          }
        }
      } catch (err) {
        console.error(`Failed to parse environment ${f}:`, err);
      }
    }
    return results;
  }

  public getEnvironment(name: string): PostmanEnvironment | undefined {
    const target = name.trim().toLowerCase();
    return this.listEnvironments().find(e => e.name.trim().toLowerCase() === target);
  }

  public saveEnvironment(env: PostmanEnvironment, originalName?: string): string {
    this.ensureDirs();
    const envDir = path.join(this.baseDir, 'environments');
    const safeName = (env.name || 'Untitled')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim();
    const standardFilePath = path.join(envDir, `${safeName}.altman_env.json`);

    const files = fs.existsSync(envDir) ? fs.readdirSync(envDir).filter(f => f.endsWith('.json')) : [];
    const lookupNames = new Set<string>();
    if (originalName) {
      const o = originalName.trim().toLowerCase();
      lookupNames.add(o);
      lookupNames.add(o.replace(/_/g, ' '));
      lookupNames.add(o.replace(/\s+/g, '_'));
    }
    if (env.name) {
      const c = env.name.trim().toLowerCase();
      lookupNames.add(c);
      lookupNames.add(c.replace(/_/g, ' '));
      lookupNames.add(c.replace(/\s+/g, '_'));
    }

    for (const f of files) {
      try {
        const fullPath = path.join(envDir, f);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const rawName = parsed.name?.trim().toLowerCase();
        if (rawName && (lookupNames.has(rawName) || lookupNames.has(rawName.replace(/_/g, ' ')))) {
          if (fullPath !== standardFilePath && fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      } catch (e) {}
    }

    fs.writeFileSync(standardFilePath, JSON.stringify(env, null, 2), 'utf8');
    return standardFilePath;
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
