export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical"
  | "off";

export interface SpdlogVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface NativeBinding {
  version: SpdlogVersion;
  log(level: LogLevel, message: string): void;
  trace(message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  critical(message: string): void;
  setLevel(level: LogLevel): void;
  setFlushOn(level: LogLevel): void;
  setPattern(pattern: string): void;
  useConsoleLogger(): void;
  useBasicFileLogger(name: string, filePath: string, truncate?: boolean | null): void;
  flush(): void;
}
