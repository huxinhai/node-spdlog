import { loadBinding } from "./binding";
import type { NativeBinding } from "./type";

export type { LogLevel, NativeBinding, SpdlogVersion } from "./type";

const spdlog: NativeBinding = loadBinding();

export const version = spdlog.version;
export const log = spdlog.log;
export const trace = spdlog.trace;
export const debug = spdlog.debug;
export const info = spdlog.info;
export const warn = spdlog.warn;
export const error = spdlog.error;
export const critical = spdlog.critical;
export const setLevel = spdlog.setLevel;
export const setFlushOn = spdlog.setFlushOn;
export const setPattern = spdlog.setPattern;
export const useConsoleLogger = spdlog.useConsoleLogger;
export const useBasicFileLogger = spdlog.useBasicFileLogger;
export const flush = spdlog.flush;

export default spdlog;
