import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const codexWeeklyLimitPath = new URL('../src/features/authFiles/codexWeeklyLimit.ts', import.meta.url);
const codexWeeklyLimitSource = await readFile(codexWeeklyLimitPath, 'utf8');
const codexWeeklyLimitTranspiled = ts.transpileModule(codexWeeklyLimitSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const codexWeeklyLimitModuleUrl = `data:text/javascript;base64,${Buffer.from(codexWeeklyLimitTranspiled.outputText).toString('base64')}`;

const monitorUtilsPath = new URL('../src/utils/monitor.ts', import.meta.url);
const monitorUtilsSource = (await readFile(monitorUtilsPath, 'utf8'))
  .replace(
    /import \{ resolveCodexWeeklyLimit \} from ['"]@\/features\/authFiles\/codexWeeklyLimit['"];\n/,
    `import { resolveCodexWeeklyLimit } from '${codexWeeklyLimitModuleUrl}';\n`,
  )
  .replace(
    /import type \{ UsageData \} from ['"]@\/pages\/MonitorPage['"];\n/,
    '',
  );
const monitorUtilsTranspiled = ts.transpileModule(monitorUtilsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const monitorUtilsModuleUrl = `data:text/javascript;base64,${Buffer.from(monitorUtilsTranspiled.outputText).toString('base64')}`;
const { countAvailableAuthFiles } = await import(monitorUtilsModuleUrl);

const monitorPageSource = await readFile(
  new URL('../src/pages/MonitorPage.tsx', import.meta.url),
  'utf8',
);

const kpiCardsSource = await readFile(
  new URL('../src/components/monitor/KpiCards.tsx', import.meta.url),
  'utf8',
);

test('监控中心向 KpiCards 传递 authFileAvailable，支持“可用/总量”展示', () => {
  assert.match(monitorPageSource, /authFileAvailable=\{authFileAvailable\}/);
});

test('可用号池数量会排除 disabled 和 unavailable 的认证文件', () => {
  assert.equal(
    countAvailableAuthFiles([
      { name: 'ready-a.json', disabled: false },
      { name: 'ready-b.json' },
      { name: 'disabled.json', disabled: true },
      { name: 'unavailable.json', unavailable: true },
      null,
      'invalid-entry',
    ]),
    2,
  );
});

test('可用号池数量会排除 Codex 429 冷却中的认证文件', () => {
  assert.equal(
    countAvailableAuthFiles([
      {
        name: 'codex-limited.json',
        type: 'codex',
        next_retry_after: '2026-04-07T23:01:29+08:00',
        status_message: '{"error":{"type":"usage_limit_reached","resets_in_seconds":601085}}',
      },
      { name: 'ready.json', type: 'codex' },
    ]),
    1,
  );
});

test('恢复时间已过但状态未刷新的 Codex 429 仍先算不可用', () => {
  const RealDate = Date;
  const frozenNow = new RealDate('2026-04-08T00:00:00+08:00');

  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(frozenNow.getTime());
        return;
      }
      super(...args);
    }

    static now() {
      return frozenNow.getTime();
    }
  }

  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  globalThis.Date = MockDate;

  try {
    assert.equal(
      countAvailableAuthFiles([
        {
          name: 'codex-expired.json',
          provider: 'codex',
          next_retry_after: '2026-04-07T20:05:00+08:00',
          status_message: '{"error":{"type":"usage_limit_reached","resets_in_seconds":590505}}',
        },
        { name: 'ready.json', provider: 'codex' },
      ]),
      1,
    );
  } finally {
    globalThis.Date = RealDate;
  }
});

test('非 Codex 的普通状态消息不会被误判为不可用', () => {
  assert.equal(
    countAvailableAuthFiles([
      {
        name: 'claude-warning.json',
        type: 'claude',
        status_message: 'upstream stream closed before first payload',
      },
      { name: 'ready.json', type: 'claude' },
    ]),
    2,
  );
});

test('号池总数卡片展示格式为“可用/总量”', () => {
  assert.match(
    kpiCardsSource,
    /authFileAvailable === null \|\| authFileTotal === null[\s\S]*\$\{authFileAvailable\.toLocaleString\(\)\}\/\$\{authFileTotal\.toLocaleString\(\)\}/
  );
});
