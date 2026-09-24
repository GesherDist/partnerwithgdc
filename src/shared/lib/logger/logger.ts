/**
 * Logger Service
 *
 * Centralized logging with different log levels.
 * Provides structured logging with context.
 */

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log context metadata
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  timestamps: boolean;
  /** Whether to include stack traces for errors */
  includeStack: boolean;
  /** Custom log handler */
  handler?: (entry: LogEntry) => void;
}

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  timestamps: true,
  includeStack: process.env.NODE_ENV !== 'production',
};

/**
 * Log level priority (lower = more verbose)
 */
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Console colors for different log levels
 */
const levelColors: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const resetColor = '\x1b[0m';

/**
 * Logger class
 */
class Logger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...defaultConfig, ...config };
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[this.config.minLevel];
  }

  /**
   * Format log entry for console output
   */
  private formatConsole(entry: LogEntry): string {
    const color = levelColors[entry.level];
    const timestamp = this.config.timestamps
      ? `${entry.timestamp} `
      : '';
    const level = `[${entry.level.toUpperCase()}]`;
    const context = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : '';

    let output = `${color}${timestamp}${level}${resetColor} ${entry.message}${context}`;

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && this.config.includeStack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  /**
   * Create log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  /**
   * Output log entry
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createEntry(level, message, context, error);

    // Use custom handler if provided
    if (this.config.handler) {
      this.config.handler(entry);
      return;
    }

    // Default console output
    const formatted = this.formatConsole(entry);
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    const ctx = error instanceof Error ? context : (error as LogContext);
    this.log('error', message, ctx, err);
  }

  /**
   * Log with timing
   */
  time(label: string): () => void {
    const start = performance.now();
    this.debug(`${label} started`);

    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { durationMs: Math.round(duration) });
    };
  }

  /**
   * Log API request
   */
  request(
    method: string,
    path: string,
    context?: LogContext
  ): void {
    this.info(`${method} ${path}`, { ...context, type: 'request' });
  }

  /**
   * Log API response
   */
  response(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${status}`, {
      ...context,
      type: 'response',
      status,
      durationMs,
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a new logger with custom config
 */
export function createLogger(
  config?: Partial<LoggerConfig>,
  context?: LogContext
): Logger {
  return new Logger(config, context);
}

export { Logger };
