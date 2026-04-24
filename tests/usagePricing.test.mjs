import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const formatSourcePath = new URL('../src/utils/format.ts', import.meta.url);
const formatSourceCode = await readFile(formatSourcePath, 'utf8');
const formatTranspiled = ts.transpileModule(formatSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const formatModuleUrl = `data:text/javascript;base64,${Buffer.from(formatTranspiled.outputText).toString('base64')}`;

const usageSourcePath = new URL('../src/utils/usage.ts', import.meta.url);
const usageSourceCode = (await readFile(usageSourcePath, 'utf8')).replace(
  /from ['"]\.\/format['"]/g,
  `from '${formatModuleUrl}'`
);
const usageTranspiled = ts.transpileModule(usageSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const usageModuleUrl = `data:text/javascript;base64,${Buffer.from(usageTranspiled.outputText).toString('base64')}`;
const {
  calculateRecentPerMinuteRates,
  calculateCost,
  extractTotalTokens,
  getOfficialModelPrices,
  loadModelPrices,
  saveModelPrices,
  summarizePricingFromDetails,
} = await import(usageModuleUrl);

test('计费公式按 input/output/cache 三段计费，不重复累计 reasoning_tokens', () => {
  const priceTable = {
    'gpt-5.3-codex': {
      prompt: 1.75,
      completion: 14,
      cache: 0.175,
    },
  };

  const cost = calculateCost(
    {
      __modelName: 'gpt-5.3-codex',
      tokens: {
        input_tokens: 1000,
        output_tokens: 200,
        reasoning_tokens: 150,
        cached_tokens: 600,
        total_tokens: 1200,
      },
    },
    priceTable
  );

  const expected = ((1000 - 600) * 1.75 + 600 * 0.175 + 200 * 14) / 1_000_000;
  assert.ok(Math.abs(cost - expected) < 1e-12);
});

test('当 total_tokens 缺失时，总 Token 回退为 input_tokens + output_tokens，不再重复累计子项', () => {
  const total = extractTotalTokens({
    tokens: {
      input_tokens: 320,
      output_tokens: 80,
      reasoning_tokens: 60,
      cached_tokens: 128,
    },
  });

  assert.equal(total, 400);
});

test('模型价格会合并官方默认价，并只持久化与默认值不同的覆盖项', () => {
  const storage = new Map();
  const localStorageMock = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = localStorageMock;

  try {
    storage.set(
      'cli-proxy-model-prices-v2',
      JSON.stringify({
        'gpt-5.4': { prompt: 3, completion: 16, cache: 0.3 },
        'custom-model': { prompt: 0.5, completion: 1.2, cache: 0.1 },
      })
    );

    const merged = loadModelPrices();
    assert.equal(merged['gpt-5.5'].prompt, 5);
    assert.equal(merged['gpt-5.5'].completion, 30);
    assert.equal(merged['gpt-5.5'].cache, 0.5);
    assert.equal(merged['gpt-5.3-codex'].prompt, 1.75);
    assert.equal(merged['gpt-5.4'].prompt, 3);
    assert.equal(merged['gpt-5.4-mini'].prompt, 0.75);
    assert.equal(merged['gpt-5.4-mini'].completion, 4.5);
    assert.equal(merged['gpt-5.4-mini'].cache, 0.075);
    assert.equal(merged['custom-model'].completion, 1.2);

    const official = getOfficialModelPrices();
    saveModelPrices({
      ...official,
      'gpt-5.3-codex': { prompt: 2, completion: 14.5, cache: 0.2 },
      'custom-model': { prompt: 0.5, completion: 1.2, cache: 0.1 },
    });

    const saved = JSON.parse(storage.get('cli-proxy-model-prices-v2'));
    assert.deepEqual(saved, {
      'gpt-5.3-codex': { prompt: 2, completion: 14.5, cache: 0.2 },
      'custom-model': { prompt: 0.5, completion: 1.2, cache: 0.1 },
    });
  } finally {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
});

test('计费覆盖汇总会区分已定价与未定价模型请求', () => {
  const summary = summarizePricingFromDetails(
    [
      {
        __modelName: 'gpt-5.4',
        tokens: {
          input_tokens: 200,
          output_tokens: 100,
          reasoning_tokens: 60,
          cached_tokens: 40,
          total_tokens: 300,
        },
      },
      {
        __modelName: 'grok-4.20-0309',
        tokens: {
          input_tokens: 20,
          output_tokens: 10,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 30,
        },
      },
    ],
    getOfficialModelPrices()
  );

  const expectedCost = ((200 - 40) * 2.5 + 40 * 0.25 + 100 * 15) / 1_000_000;
  assert.ok(Math.abs(summary.totalCost - expectedCost) < 1e-12);
  assert.equal(summary.pricedRequestCount, 1);
  assert.equal(summary.unpricedRequestCount, 1);
  assert.deepEqual(summary.unpricedModels, ['grok-4.20-0309']);
});

test('最近每分钟速率支持显式传入 nowMs，避免监控卡牌与刷新时间错位', () => {
  const nowMs = Date.parse('2026-04-11T12:30:00Z');
  const stats = calculateRecentPerMinuteRates(
    30,
    {
      apis: {
        sk_monitor_demo_1234567890: {
          models: {
            'gpt-5.4': {
              details: [
                {
                  timestamp: '2026-04-11T12:05:00Z',
                  failed: false,
                  source: 'src-a',
                  auth_index: 0,
                  tokens: {
                    input_tokens: 60,
                    output_tokens: 40,
                    reasoning_tokens: 10,
                    cached_tokens: 20,
                    total_tokens: 100,
                  },
                },
                {
                  timestamp: '2026-04-11T12:20:00Z',
                  failed: false,
                  source: 'src-a',
                  auth_index: 0,
                  tokens: {
                    input_tokens: 30,
                    output_tokens: 20,
                    reasoning_tokens: 5,
                    cached_tokens: 0,
                    total_tokens: 50,
                  },
                },
                {
                  timestamp: '2026-04-11T11:40:00Z',
                  failed: false,
                  source: 'src-a',
                  auth_index: 0,
                  tokens: {
                    input_tokens: 200,
                    output_tokens: 100,
                    reasoning_tokens: 20,
                    cached_tokens: 0,
                    total_tokens: 300,
                  },
                },
              ],
            },
          },
        },
      },
    },
    nowMs
  );

  assert.equal(stats.windowMinutes, 30);
  assert.equal(stats.requestCount, 2);
  assert.equal(stats.tokenCount, 150);
  assert.equal(stats.rpm, 2 / 30);
  assert.equal(stats.tpm, 150 / 30);
});
