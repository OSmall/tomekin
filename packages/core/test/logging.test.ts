import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRootLogger, resolveLogConfigFromEnv, resolveTestLogConfigFromEnv} from "@tomekin/core";

describe("project logging", () => {
  test("resolves profile defaults and environment overrides", () => {
    expect(resolveLogConfigFromEnv({})).toEqual({
      profile: "development",
      enabled: true,
      destination: "file",
      file: ".data/tomekin.log",
      level: "debug",
      format: "pretty",
    });
    expect(resolveLogConfigFromEnv({NODE_ENV: " production "})).toMatchObject({
      profile: "production",
      destination: "stdout",
      level: "info",
      format: "json",
    });
    expect(resolveLogConfigFromEnv({NODE_ENV: "test"})).toMatchObject({
      profile: "test",
      destination: "stderr",
      file: ".data/tomekin.log",
      level: "info",
    });
    expect(resolveLogConfigFromEnv({
      NODE_ENV: "test",
      TOMEKIN_LOG_DESTINATION: " file ",
      TOMEKIN_LOG_FILE: " /tmp/tomekin-test.log ",
      TOMEKIN_LOG_LEVEL: " debug ",
      TOMEKIN_LOG_FORMAT: " json ",
    })).toEqual({
      profile: "test",
      enabled: true,
      destination: "file",
      file: "/tmp/tomekin-test.log",
      level: "debug",
      format: "json",
    });
  });

  test("test config helper defaults NODE_ENV while preserving logging overrides", () => {
    expect(resolveTestLogConfigFromEnv({})).toMatchObject({
      profile: "test",
      destination: "stderr",
      level: "info",
      format: "pretty",
    });
    expect(resolveTestLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"}).enabled).toBe(false);
    expect(resolveTestLogConfigFromEnv({NODE_ENV: "production"}).profile).toBe("production");
  });

  test("fails fast on invalid logging environment values", () => {
    expect(resolveLogConfigFromEnv({NODE_ENV: "staging"}).profile).toBe("development");
    expect(() => resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "yes"})).toThrow("Invalid TOMEKIN_LOG_ENABLED");
    expect(() => resolveLogConfigFromEnv({TOMEKIN_LOG_DESTINATION: "console"})).toThrow("Invalid TOMEKIN_LOG_DESTINATION");
    expect(() => resolveLogConfigFromEnv({TOMEKIN_LOG_LEVEL: "verbose"})).toThrow("Invalid TOMEKIN_LOG_LEVEL");
    expect(() => resolveLogConfigFromEnv({TOMEKIN_LOG_FORMAT: "text"})).toThrow("Invalid TOMEKIN_LOG_FORMAT");
  });

  test("writes component-bound structured JSON records when JSON format is selected", () => {
    const logPath = join(mkdtempSync(join(tmpdir(), "tomekin-log-")), "agent.log");
    const logger = createRootLogger(
        resolveLogConfigFromEnv({
          TOMEKIN_LOG_DESTINATION: "file",
          TOMEKIN_LOG_FILE: logPath,
          TOMEKIN_LOG_LEVEL: "debug",
          TOMEKIN_LOG_FORMAT: "json"
        }),
      {timestamp: false},
    ).child({component: "cli"});

    logger.child({command: "test"}).info({operation: "unit_test", status: "succeeded"}, "logger test");

    const [line] = readFileSync(logPath, "utf8").trim().split("\n");
    expect(JSON.parse(line ?? "{}")).toMatchObject({
      level: 30,
      component: "cli",
      command: "test",
      operation: "unit_test",
      status: "succeeded",
      msg: "logger test",
    });
  });

  test("writes human-readable pretty records by default", () => {
    const logPath = join(mkdtempSync(join(tmpdir(), "tomekin-log-")), "agent.log");
    const logger = createRootLogger(
        resolveLogConfigFromEnv({
          TOMEKIN_LOG_DESTINATION: "file",
          TOMEKIN_LOG_FILE: logPath,
          TOMEKIN_LOG_LEVEL: "debug"
        }),
        {timestamp: false},
    ).child({component: "cli"});

    logger.child({command: "test"}).info({operation: "unit_test", status: "succeeded"}, "pretty logger test");

    const output = readFileSync(logPath, "utf8").trim();
    expect(output).toContain("pretty logger test");
    expect(output).toContain("unit_test");
    expect(() => JSON.parse(output)).toThrow();
  });

  test("writes multiline pretty query fields in triple-quoted blocks", () => {
    const logPath = join(mkdtempSync(join(tmpdir(), "tomekin-log-")), "agent.log");
    const logger = createRootLogger(
        resolveLogConfigFromEnv({
          TOMEKIN_LOG_DESTINATION: "file",
          TOMEKIN_LOG_FILE: logPath,
          TOMEKIN_LOG_LEVEL: "debug"
        }),
        {timestamp: false},
    ).child({component: "sqlite"});

    logger.debug({
      operation: "unit_test",
      query: "select *\nfrom card_identity\nwhere id = ?",
      params: ["card-id"]
    }, "query test");

    const output = readFileSync(logPath, "utf8");
    expect(output).toContain('query: """');
    expect(output).toContain("select *\n");
    expect(output).toContain("from card_identity\n");
    expect(output).toContain("where id = ?\n");
    expect(output).toContain('"""\n    params:');
    expect(output).not.toContain("select *\\nfrom card_identity");
  });

  test("logging disabled produces a no-op logger", async () => {
    const logPath = join(mkdtempSync(join(tmpdir(), "tomekin-log-")), "agent.log");
    const logger = createRootLogger(
        resolveLogConfigFromEnv({
          TOMEKIN_LOG_ENABLED: "false",
          TOMEKIN_LOG_DESTINATION: "file",
          TOMEKIN_LOG_FILE: logPath
        }),
        {timestamp: false},
    ).child({component: "cli"});

    logger.info({operation: "unit_test"}, "disabled logger test");

    await expect(Bun.file(logPath).exists()).resolves.toBe(false);
  });
});
