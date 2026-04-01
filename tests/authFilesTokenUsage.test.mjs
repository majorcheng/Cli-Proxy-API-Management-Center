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
  `from '${formatModuleUrl}'`,
);
const usageTranspiled = ts.transpileModule(usageSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const usageModuleUrl = `data:text/javascript;base64,${Buffer.from(usageTranspiled.outputText).toString('base64')}`;
const { computeKeyStatsFromDetails } = await import(usageModuleUrl);

const cardSource = await readFile(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8',
);
const zhSource = await readFile(
  new URL('../src/i18n/locales/zh-CN.json', import.meta.url),
  'utf8',
);

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

test('认证文件卡牌展示已用统计，并复用紧凑数值格式化', () => {
  assert.match(cardSource, /t\('auth_files\.tokens_used'\)/);
  assert.match(cardSource, /formatCompactNumber\(fileStats\.totalTokens\)/);
  assert.match(cardSource, /styles\.statTokens/);
  assert.match(zhSource, /"tokens_used"\s*:\s*"已用"/);
});
