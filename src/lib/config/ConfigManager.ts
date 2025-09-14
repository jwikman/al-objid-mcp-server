import * as fs from 'fs';
import * as path from 'path';
import * as JSONC from 'comment-json';
import { Logger } from '../utils/Logger';

export interface BackendConfig {
  url?: string;
  apiKey?: string;
  pollUrl?: string;
  pollKey?: string;
}

export interface Config {
  backend: BackendConfig;
  defaults: {
    includeUserName: boolean;
    verboseLogging: boolean;
  };
}

export interface ObjIdConfig {
  authKey?: string;
  appPoolId?: string;
  idRanges?: Array<{ from: number; to: number }>;
  objectRanges?: {
    [key: string]: Array<{
      from: number;
      to: number;
      description?: string;
    }>;
  };
}

export interface AppManifest {
  id: string;
  name: string;
  publisher: string;
  version: string;
  idRanges?: Array<{ from: number; to: number }>;
}

// Default backend URL to match VS Code extension behavior
const DEFAULT_BACKEND_URL = "vjekocom-alext-weu.azurewebsites.net";

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config | null = null;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!this.instance) {
      this.instance = new ConfigManager();
    }
    return this.instance;
  }

  loadConfig(): Config {
    if (this.config) {
      return this.config;
    }

    // Start with defaults
    const config: Config = {
      backend: {
        url: DEFAULT_BACKEND_URL,  // Use default URL
      },
      defaults: {
        includeUserName: true,
        verboseLogging: false,
      },
    };

    // Load from config file if exists
    const configPath = path.join(process.cwd(), 'mcp-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        Object.assign(config, fileConfig);
      } catch (error) {
        Logger.getInstance().error('Error loading config file:', error);
      }
    }

    // Override with environment variables
    if (process.env.NINJA_BACKEND_URL) {
      config.backend.url = process.env.NINJA_BACKEND_URL;
    }
    if (process.env.NINJA_API_KEY) {
      config.backend.apiKey = process.env.NINJA_API_KEY;
    }
    if (process.env.NINJA_POLL_URL) {
      config.backend.pollUrl = process.env.NINJA_POLL_URL;
    }
    if (process.env.NINJA_POLL_KEY) {
      config.backend.pollKey = process.env.NINJA_POLL_KEY;
    }
    if (process.env.NINJA_INCLUDE_USERNAME !== undefined) {
      config.defaults.includeUserName = process.env.NINJA_INCLUDE_USERNAME === 'true';
    }
    if (process.env.NINJA_VERBOSE_LOGGING !== undefined) {
      config.defaults.verboseLogging = process.env.NINJA_VERBOSE_LOGGING === 'true';
    }

    this.config = config;
    return config;
  }

  validateConfig(config: Config): boolean {
    // Validate required fields and formats
    if (!config.backend.url) {
      Logger.getInstance().error('Backend URL is required');
      return false;
    }

    try {
      new URL(`https://${config.backend.url}`);
    } catch {
      Logger.getInstance().error('Invalid backend URL format');
      return false;
    }

    return true;
  }

  loadObjIdConfig(appPath: string): ObjIdConfig | null {
    const configPath = path.join(appPath, '.objidconfig');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSONC.parse(content) as ObjIdConfig;
    } catch (error) {
      Logger.getInstance().error('Error parsing .objidconfig:', error);
      return null;
    }
  }

  loadAppManifest(appPath: string): AppManifest | null {
    const manifestPath = path.join(appPath, 'app.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(content) as AppManifest;
    } catch (error) {
      Logger.getInstance().error('Error parsing app.json:', error);
      return null;
    }
  }
}