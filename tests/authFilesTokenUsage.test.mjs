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
const { computeKeyStatsFromDetails } = await import(usageModuleUrl);

const codexWeeklyLimitSourcePath = new URL(
  '../src/features/authFiles/codexWeeklyLimit.ts',
  import.meta.url
);
const codexWeeklyLimitSourceCode = await readFile(codexWeeklyLimitSourcePath, 'utf8');
const codexWeeklyLimitTranspiled = ts.transpileModule(codexWeeklyLimitSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const codexWeeklyLimitModuleUrl = `data:text/javascript;base64,${Buffer.from(codexWeeklyLimitTranspiled.outputText).toString('base64')}`;

const tokenUsageSourcePath = new URL('../src/features/authFiles/tokenUsage.ts', import.meta.url);
const tokenUsageSourceCode = (await readFile(tokenUsageSourcePath, 'utf8'))
  .replace(/from ['"]@\/utils\/usage['"]/g, `from '${usageModuleUrl}'`)
  .replace(
    /from ['"]@\/features\/authFiles\/codexWeeklyLimit['"]/g,
    `from '${codexWeeklyLimitModuleUrl}'`
  );
const tokenUsageTranspiled = ts.transpileModule(tokenUsageSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const tokenUsageModuleUrl = `data:text/javascript;base64,${Buffer.from(tokenUsageTranspiled.outputText).toString('base64')}`;
const { buildAuthFileUsedTokensMap, buildAuthFileUsageSummaryMap } = await import(
  tokenUsageModuleUrl
);

const cardSource = await readFile(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8'
);
const pageSource = await readFile(
  new URL('../src/pages/AuthFilesPage.tsx', import.meta.url),
  'utf8'
);
const zhSource = await readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8');

test('认证文件统计会按 auth_index/source 聚合累计 totalTokens', () => {
  const stats = computeKeyStatsFromDetails([
    {
      timestamp: '2026-04-01T09:00:00Z',
      source: 'alpha.json',
      auth_index: 'auth-a',
      failed: false,
      tokens: {
        input_tokens: 80,
        output_tokens: 40,
        reasoning_tokens: 0,
        cached_tokens: 0,
        total_tokens: 120,
      },
    },
    {
      timestamp: '2026-04-01T09:05:00Z',
      source: 'alpha.json',
      auth_index: 'auth-a',
      failed: true,
      tokens: {
        input_tokens: 20,
        output_tokens: 10,
        reasoning_tokens: 0,
        cached_tokens: 0,
      },
    },
    {
      timestamp: '2026-04-01T09:10:00Z',
      source: '',
      auth_index: 'auth-b',
      failed: false,
      tokens: {
        input_tokens: 2,
        output_tokens: 3,
        reasoning_tokens: 0,
        cached_tokens: 0,
        total_tokens: 5,
      },
    },
  ]);

  assert.deepEqual(stats.bySource['alpha.json'], {
    success: 1,
    failure: 1,
    totalTokens: 150,
  });
  assert.deepEqual(stats.byAuthIndex['auth-a'], {
    success: 1,
    failure: 1,
    totalTokens: 150,
  });
  assert.deepEqual(stats.byAuthIndex['auth-b'], {
    success: 1,
    failure: 0,
    totalTokens: 5,
  });
});

test('认证文件已用量会限制在最近 7 天，且 Codex 429 周限时改看上一整个周限周期', () => {
  const nowMs = Date.parse('2026-04-08T12:00:00+08:00');
  const usedTokensMap = buildAuthFileUsedTokensMap(
    [
      {
        name: 'codex-a.json',
        provider: 'codex',
        auth_index: 'codex-a',
        next_retry_after: '2026-04-10T00:00:00+08:00',
        updated_at: '2026-04-08T11:00:00+08:00',
        status_message:
          '{"error":{"type":"usage_limit_reached","resets_at":1775750400,"resets_in_seconds":129600}}',
      },
      {
        name: 'claude-a.json',
        provider: 'claude',
        auth_index: 'claude-a',
        status_message: 'ok',
      },
    ],
    [
      {
        timestamp: '2026-04-04T10:00:00+08:00',
        source: 't:codex-a.json',
        auth_index: 'codex-a',
        failed: false,
        tokens: {
          input_tokens: 300,
          output_tokens: 200,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 500,
        },
      },
      {
        timestamp: '2026-04-10T10:00:00+08:00',
        source: 't:codex-a.json',
        auth_index: 'codex-a',
        failed: true,
        tokens: {
          input_tokens: 10,
          output_tokens: 10,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 20,
        },
      },
      {
        timestamp: '2026-03-31T11:59:00+08:00',
        source: 't:claude-a.json',
        auth_index: 'claude-a',
        failed: false,
        tokens: {
          input_tokens: 50,
          output_tokens: 20,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 70,
        },
      },
      {
        timestamp: '2026-04-07T13:00:00+08:00',
        source: 't:claude-a.json',
        auth_index: 'claude-a',
        failed: false,
        tokens: {
          input_tokens: 80,
          output_tokens: 40,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 120,
        },
      },
    ],
    nowMs
  );

  assert.equal(usedTokensMap.get('codex-a.json'), 500);
  assert.equal(usedTokensMap.get('claude-a.json'), 120);
});

test('认证文件花费会复用同一时间窗口，并标记未定价模型缺口', () => {
  const nowMs = Date.parse('2026-04-08T12:00:00+08:00');
  const usageSummaryMap = buildAuthFileUsageSummaryMap(
    [
      {
        name: 'claude-a.json',
        provider: 'claude',
        auth_index: 'claude-a',
        status_message: 'ok',
      },
    ],
    [
      {
        timestamp: '2026-04-07T13:00:00+08:00',
        source: 't:claude-a.json',
        auth_index: 'claude-a',
        failed: false,
        __modelName: 'gpt-5.3-codex',
        tokens: {
          input_tokens: 80,
          output_tokens: 40,
          reasoning_tokens: 12,
          cached_tokens: 20,
          total_tokens: 120,
        },
      },
      {
        timestamp: '2026-04-07T14:00:00+08:00',
        source: 't:claude-a.json',
        auth_index: 'claude-a',
        failed: false,
        __modelName: 'grok-4.20-0309',
        tokens: {
          input_tokens: 10,
          output_tokens: 10,
          reasoning_tokens: 0,
          cached_tokens: 0,
          total_tokens: 20,
        },
      },
    ],
    {
      'gpt-5.3-codex': {
        prompt: 1.75,
        completion: 14,
        cache: 0.175,
      },
    },
    nowMs
  );

  const summary = usageSummaryMap.get('claude-a.json');
  assert.equal(summary.totalTokens, 140);
  assert.equal(summary.pricedRequestCount, 1);
  assert.equal(summary.unpricedRequestCount, 1);
  assert.deepEqual(summary.unpricedModels, ['grok-4.20-0309']);
  const expectedCost = ((80 - 20) * 1.75 + 20 * 0.175 + 40 * 14) / 1_000_000;
  assert.ok(Math.abs(summary.totalCost - expectedCost) < 1e-12);
});

test('认证文件卡牌同时展示已用 Token 与花费，并复用同一份窗口汇总', () => {
  assert.match(cardSource, /t\('auth_files\.tokens_used'\)/);
  assert.match(cardSource, /t\('auth_files\.cost_used'\)/);
  assert.match(cardSource, /usedTokens: number;/);
  assert.match(cardSource, /usageCost: AuthFileUsageCost \| null;/);
  assert.match(cardSource, /formatCompactNumber\(usedTokens\)/);
  assert.match(cardSource, /formatUsd\(usageCost\.totalCost\)/);
  assert.match(cardSource, /styles\.statTokens/);
  assert.match(cardSource, /styles\.statCost/);
  assert.match(cardSource, /styles\.inlineStats[\s\S]*styles\.statTokens[\s\S]*styles\.statCost/);
  assert.match(pageSource, /buildAuthFileUsageSummaryMap\(files,\s*usageDetails,\s*modelPrices\)/);
  assert.match(
    pageSource,
    /usedTokens=\{authFileUsageSummary\.get\(file\.name\)\?\.totalTokens \?\? 0\}/
  );
  assert.match(pageSource, /usageCost=\{\(\(\) => \{/);
  assert.match(zhSource, /"tokens_used"\s*:\s*"已用"/);
  assert.match(zhSource, /"cost_used"\s*:\s*"花费"/);
});
