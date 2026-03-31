import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/utils/monitor.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  MONITOR_PRESET_TIME_RANGES,
  getTimeRangeBounds,
  filterDataByTimeRange,
  formatPresetTimeRangeLabel,
} = await import(moduleUrl);

test('监控中心预设时间范围中，昨天紧跟在今天后面', () => {
  assert.deepEqual(MONITOR_PRESET_TIME_RANGES, [1, 'yesterday', 7, 14, 30]);
});

test('昨天范围会精确落在昨天 00:00:00 到 23:59:59.999', () => {
  const now = new Date('2026-04-01T12:34:56+08:00');
  const { start, end } = getTimeRangeBounds('yesterday', undefined, now);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 2);
  assert.equal(start.getDate(), 31);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getMilliseconds(), 0);

  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 2);
  assert.equal(end.getDate(), 31);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
});

test('昨天范围过滤只保留昨天的请求', () => {
  const data = {
    apis: {
      sk_test: {
        models: {
          'gpt-4.1': {
            details: [
              {
                timestamp: '2026-03-31T01:23:45+08:00',
                failed: false,
                source: 'src-a',
                auth_index: 'auth-a',
                tokens: {
                  input_tokens: 1,
                  output_tokens: 2,
                  reasoning_tokens: 0,
                  cached_tokens: 0,
                  total_tokens: 3,
                },
              },
              {
                timestamp: '2026-04-01T01:23:45+08:00',
                failed: false,
                source: 'src-a',
                auth_index: 'auth-a',
                tokens: {
                  input_tokens: 4,
                  output_tokens: 5,
                  reasoning_tokens: 0,
                  cached_tokens: 0,
                  total_tokens: 9,
                },
              },
            ],
          },
        },
      },
    },
  };

  const RealDate = Date;
  const frozenNow = new RealDate('2026-04-01T12:34:56+08:00');

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
    const filtered = filterDataByTimeRange(data, 'yesterday');
    const details = filtered.apis.sk_test.models['gpt-4.1'].details;

    assert.equal(details.length, 1);
    assert.equal(details[0].timestamp, '2026-03-31T01:23:45+08:00');
  } finally {
    globalThis.Date = RealDate;
  }
});

test('昨天标签会走独立文案，而不是最近 N 天', () => {
  const translateCalls = [];
  const t = (key, options) => {
    translateCalls.push({ key, options });
    if (key === 'monitor.yesterday') return '昨天';
    return String(key);
  };

  assert.equal(formatPresetTimeRangeLabel('yesterday', t), '昨天');
  assert.deepEqual(translateCalls, [{ key: 'monitor.yesterday', options: undefined }]);
});
