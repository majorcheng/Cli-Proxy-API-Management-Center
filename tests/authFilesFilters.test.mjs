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
  { name: 'alpha.json', type: 'codex', provider: 'openai', disabled: false },
  {
    name: 'beta.json',
    type: 'codex',
    provider: 'openai',
    disabled: true,
    status_message: 'quota warning',
  },
  { name: 'gamma.json', type: 'claude', provider: 'anthropic', disabled: true },
  {
    name: 'delta.json',
    type: 'claude',
    provider: 'anthropic',
    disabled: false,
    statusMessage: 'needs refresh',
  },
];

test('仅显示未启用凭证会过滤出 disabled=true 的文件', () => {
  const result = applyAuthFilesScopeFilters(SAMPLE_FILES, {
    typeFilter: 'all',
    disabledOnly: true,
  });
  assert.deepEqual(
    result.map((item) => item.name),
    ['beta.json', 'gamma.json']
  );
});

test('问题筛选与未启用筛选可以叠加生效', () => {
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
