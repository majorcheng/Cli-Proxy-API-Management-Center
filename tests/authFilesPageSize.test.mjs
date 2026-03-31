import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/features/authFiles/pageSize.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  MIN_CARD_PAGE_SIZE,
  MAX_CARD_PAGE_SIZE,
  DEFAULT_REGULAR_CARD_PAGE_SIZE,
  DEFAULT_COMPACT_CARD_PAGE_SIZE,
  clampCardPageSize,
  resolveAuthFilesPageSize,
} = await import(moduleUrl);

test('认证文件页单页数量默认值提升到 100', () => {
  assert.equal(DEFAULT_REGULAR_CARD_PAGE_SIZE, 100);
  assert.equal(DEFAULT_COMPACT_CARD_PAGE_SIZE, 100);
});

test('认证文件页分页上限提升到 100', () => {
  assert.equal(MAX_CARD_PAGE_SIZE, 100);
  assert.equal(clampCardPageSize(120), 100);
});

test('认证文件页分页下限与取整行为保持稳定', () => {
  assert.equal(MIN_CARD_PAGE_SIZE, 3);
  assert.equal(clampCardPageSize(2), 3);
  assert.equal(clampCardPageSize(18.6), 19);
});

test('旧默认分页值会迁移到新的 100，而自定义值仍然保留', () => {
  assert.equal(resolveAuthFilesPageSize(9, DEFAULT_REGULAR_CARD_PAGE_SIZE), 100);
  assert.equal(resolveAuthFilesPageSize(12, DEFAULT_COMPACT_CARD_PAGE_SIZE), 100);
  assert.equal(resolveAuthFilesPageSize(30, DEFAULT_COMPACT_CARD_PAGE_SIZE), 30);
  assert.equal(resolveAuthFilesPageSize(undefined, DEFAULT_COMPACT_CARD_PAGE_SIZE), 100);
});
