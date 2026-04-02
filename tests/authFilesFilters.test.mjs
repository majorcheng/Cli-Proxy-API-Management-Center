import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/features/authFiles/filters.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { applyAuthFilesScopeFilters, applyAuthFilesVisibilityFilters } = await import(moduleUrl);

const SAMPLE_FILES = [
  {
    name: 'alpha.json',
    type: 'codex',
    provider: 'codex',
    disabled: false,
    has_refresh_token: true,
  },
  {
    name: 'beta.json',
    type: 'codex',
    provider: 'openai',
    disabled: true,
    has_refresh_token: false,
    status_message: 'quota warning',
  },
  {
    name: 'gamma.json',
    type: 'claude',
    provider: 'anthropic',
    disabled: false,
    refresh_token: '',
  },
  {
    name: 'delta.json',
    type: 'claude',
    provider: 'anthropic',
    disabled: false,
    has_refresh_token: true,
    statusMessage: 'needs refresh',
  },
  {
    name: 'epsilon.json',
    type: 'codex',
    provider: 'codex',
    disabled: false,
    has_refresh_token: true,
    status_message:
      '{"error":{"type":"usage_limit_reached","resets_at":1775574090,"resets_in_seconds":601085}}',
    next_retry_after: '2026-04-07T23:01:29+08:00',
  },
];

test('仅显示无法刷新凭证会过滤出 refresh_token 为空的文件', () => {
  const result = applyAuthFilesScopeFilters(SAMPLE_FILES, {
    typeFilter: 'all',
    disabledOnly: true,
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ['beta.json', 'gamma.json']
  );
});

test('问题筛选与无法刷新筛选可以叠加生效', () => {
  const result = applyAuthFilesScopeFilters(SAMPLE_FILES, {
    typeFilter: 'all',
    problemOnly: true,
    disabledOnly: true,
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ['beta.json']
  );
});

test('展示过滤会继续叠加类型与搜索关键字', () => {
  const result = applyAuthFilesVisibilityFilters(SAMPLE_FILES, {
    typeFilter: 'claude',
    disabledOnly: true,
    searchTerm: 'gamma',
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ['gamma.json']
  );
});

test('仅显示可用凭证会排除 disabled/unavailable 与 codex 429 冷却账号', () => {
  const result = applyAuthFilesScopeFilters(
    [
      ...SAMPLE_FILES,
      { name: 'zeta.json', type: 'gemini', provider: 'gemini', unavailable: true },
    ],
    {
      typeFilter: 'all',
      availableOnly: true,
    }
  );
  assert.deepEqual(
    result.map((item) => item.name),
    ['alpha.json', 'gamma.json', 'delta.json']
  );
});
