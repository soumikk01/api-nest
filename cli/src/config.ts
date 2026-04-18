import * as fs from 'fs';
import * as path from 'path';

export interface CliConfig {
  sdkToken: string;
  projectId?: string;
  backendUrl: string;
}

const CONFIG_FILE = '.api-nest.json';

export function saveConfig(config: CliConfig, cwd = process.cwd()) {
  const filePath = path.join(cwd, CONFIG_FILE);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  return filePath;
}

/**
 * Walks UP the directory tree from cwd until it finds .api-nest.json.
 * This handles monorepos where the CLI is run from root but the server
 * runs from a subdirectory (e.g. cwd = backend/, config is at root/).
 */
export function loadConfig(startDir = process.cwd()): CliConfig | null {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {        // max 6 levels up
    const filePath = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as CliConfig;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;          // reached filesystem root
    dir = parent;
  }
  return null;
}
