import {mkdirSync} from "node:fs";
import {dirname} from "node:path";
import pino, {type Logger, type LoggerOptions} from "pino";
import pretty from "pino-pretty";

export type {Logger} from "pino";

export const defaultLogFile = ".data/tomekin.log";
export const defaultLogLevel = "debug";
export const defaultLogFormat = "pretty";
export type LogProfile = "development" | "production" | "test";
export type LogDestination = "file" | "stdout" | "stderr";
export type LogFormat = "pretty" | "json";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export type LogComponent =
  | "cli"
  | "sqlite"
  | "opencode"
  | "scryfall_import"
  | "scryfall_sync"
  | "agent_tool";

export type LoggingEnv = {
  readonly [key: string]: string | undefined;
    readonly NODE_ENV?: string | undefined;
    readonly TOMEKIN_LOG_ENABLED?: string | undefined;
    readonly TOMEKIN_LOG_DESTINATION?: string | undefined;
    readonly TOMEKIN_LOG_FILE?: string | undefined;
  readonly TOMEKIN_LOG_LEVEL?: string | undefined;
    readonly TOMEKIN_LOG_FORMAT?: string | undefined;
};

export type ResolvedLogConfig = {
    readonly profile: LogProfile;
    readonly enabled: boolean;
    readonly destination: LogDestination;
    readonly file: string;
    readonly level: LogLevel;
    readonly format: LogFormat;
};

const profileDefaults: Record<LogProfile, ResolvedLogConfig> = {
    development: {
        profile: "development",
        enabled: true,
        destination: "file",
        file: defaultLogFile,
        level: "debug",
        format: "pretty"
    },
    production: {
        profile: "production",
        enabled: true,
        destination: "stdout",
        file: defaultLogFile,
        level: "info",
        format: "json"
    },
    test: {
        profile: "test",
        enabled: true,
        destination: "stderr",
        file: defaultLogFile,
        level: "info",
        format: "pretty"
    },
};

export function resolveLogConfigFromEnv(env: LoggingEnv = process.env): ResolvedLogConfig {
    const profile = resolveProfile(env.NODE_ENV);
    const defaults = profileDefaults[profile];
    const enabled = resolveBoolean("TOMEKIN_LOG_ENABLED", env.TOMEKIN_LOG_ENABLED, defaults.enabled);
  return {
      profile,
      enabled,
      destination: resolveEnum("TOMEKIN_LOG_DESTINATION", env.TOMEKIN_LOG_DESTINATION, ["file", "stdout", "stderr"], defaults.destination),
      file: env.TOMEKIN_LOG_FILE?.trim() || defaults.file,
      level: resolveEnum("TOMEKIN_LOG_LEVEL", env.TOMEKIN_LOG_LEVEL, ["trace", "debug", "info", "warn", "error"], defaults.level),
      format: resolveEnum("TOMEKIN_LOG_FORMAT", env.TOMEKIN_LOG_FORMAT, ["pretty", "json"], defaults.format),
  };
}

export function resolveTestLogConfigFromEnv(env: LoggingEnv = process.env): ResolvedLogConfig {
    return resolveLogConfigFromEnv({...env, NODE_ENV: env.NODE_ENV ?? "test"});
}

export function createRootLogger(
    config: ResolvedLogConfig = resolveLogConfigFromEnv(),
  options: Pick<LoggerOptions, "timestamp"> = {},
): Logger {
  const loggerOptions: LoggerOptions = {
      level: config.enabled ? config.level : "silent",
    redact: {
      paths: ["password", "token", "apiKey", "secret", "*.password", "*.token", "*.apiKey", "*.secret"],
      remove: true,
    },
  };
  if (options.timestamp !== undefined) loggerOptions.timestamp = options.timestamp;
    if (!config.enabled) return pino(loggerOptions);
    const destination = resolveDestination(config);
    return config.format === "json"
        ? pino(loggerOptions, pino.destination({dest: destination, sync: true}))
        : pino(loggerOptions, pretty({
            destination,
            mkdir: true,
            sync: true,
            colorize: false,
            customPrettifiers: {query: formatPrettyQuery},
        }));
}

export function createTestRootLoggerFromEnv(
    env: LoggingEnv = process.env,
    options: Pick<LoggerOptions, "timestamp"> = {},
): Logger {
    return createRootLogger(resolveTestLogConfigFromEnv(env), options);
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {name: error.name, message: error.message, stack: error.stack};
  }
  return {message: String(error)};
}

function resolveProfile(value: string | undefined): LogProfile {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "production" || normalized === "test") return normalized;
    return "development";
}

function resolveEnum<const T extends string>(name: string, value: string | undefined, allowed: readonly T[], fallback: T): T {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return fallback;
    if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
    throw new Error(`Invalid ${name}: ${value}. Expected one of: ${allowed.join(", ")}.`);
}

function resolveBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new Error(`Invalid ${name}: ${value}. Expected true or false.`);
}

function formatPrettyQuery(value: unknown): string {
    if (typeof value !== "string" || !value.includes("\n")) return JSON.stringify(value) ?? String(value);
    return `"""\n${value}\n"""`;
}

function resolveDestination(config: ResolvedLogConfig): string | number {
    if (config.destination === "stdout") return 1;
    if (config.destination === "stderr") return 2;
    mkdirSync(dirname(config.file), {recursive: true});
    return config.file;
}
