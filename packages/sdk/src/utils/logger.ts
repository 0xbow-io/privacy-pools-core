export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  enabled?: boolean;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.enabled = options.enabled ?? true;
  }

  private formatMessage(level: string, message: string): string {
    return `${new Date().toISOString()} [${this.prefix}::${level}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled && this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage("DEBUG", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled && this.level <= LogLevel.INFO) {
      console.log(this.formatMessage("INFO", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled && this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message), ...args);
    }
  }

  error(message: string, error?: Error, ...args: unknown[]): void {
    if (this.enabled && this.level <= LogLevel.ERROR) {
      console.error(
        this.formatMessage("ERROR", message),
        error?.stack ?? "",
        ...args,
      );
    }
  }
} 