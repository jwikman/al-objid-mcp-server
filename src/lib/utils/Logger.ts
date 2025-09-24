export enum LogLevel {
  Error = 0,
  Info = 1,
  Verbose = 2,
  Debug = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.Info;
  private sensitiveKeys = [
    'authKey',
    'apiKey',
    'X-Functions-Key',
    'x-functions-key',
    'pollKey',
    'password',
    'token',
    'secret'
  ];

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }
    return this.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  error(message: string, error?: any): void {
    if (this.logLevel >= LogLevel.Error) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[ERROR] ${this.timestamp()} ${message} ${error ? JSON.stringify(this.sanitizeData(error)) : ''}\n`);
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.Info) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[INFO] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  verbose(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.Verbose) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[VERBOSE] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.Info) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[WARN] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        'error': LogLevel.Error,
        'info': LogLevel.Info,
        'verbose': LogLevel.Verbose,
        'debug': LogLevel.Debug
      };
      this.logLevel = levelMap[level.toLowerCase()] || LogLevel.Info;
    } else {
      this.logLevel = level;
    }
  }

  debug(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.Debug) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[DEBUG] ${this.timestamp()} ${message} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  request(method: string, url: string, data?: any): void {
    if (this.logLevel >= LogLevel.Verbose) {
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[REQUEST] ${this.timestamp()} ${method} ${url} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  response(status: number, url: string, data?: any): void {
    if (this.logLevel >= LogLevel.Verbose) {
      const statusText = status >= 200 && status < 300 ? 'SUCCESS' : 'FAILURE';
      // Use stderr to avoid breaking stdio transport
      process.stderr.write(`[RESPONSE] ${this.timestamp()} ${statusText} (${status}) ${url} ${data ? JSON.stringify(this.sanitizeData(data)) : ''}\n`);
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (data instanceof Error) {
      return {
        message: data.message,
        stack: data.stack,
        ...this.sanitizeData({ ...data })
      };
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = this.sensitiveKeys.some(sensitive =>
            lowerKey.includes(sensitive.toLowerCase())
          );

          if (isSensitive && data[key]) {
            sanitized[key] = '***REDACTED***';
          } else {
            sanitized[key] = this.sanitizeData(data[key]);
          }
        }
      }
      return sanitized;
    }

    return data;
  }
}