import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/components/quota/pagination.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { MAX_ITEMS_PER_PAGE, resolveQuotaPagedPageSize } = await import(moduleUrl);

test('未配置固定分页时，配额页沿用按列数动态推导的默认口径', () => {
  assert.equal(resolveQuotaPagedPageSize(2), 6);
  assert.equal(resolveQuotaPagedPageSize(4), 12);
});

test('Codex 可覆盖默认单页数量为 20', () => {
  assert.equal(resolveQuotaPagedPageSize(2, 20), 20);
  assert.equal(resolveQuotaPagedPageSize(5, 20), 20);
});

test('固定分页数量仍受全局上限保护', () => {
  assert.equal(MAX_ITEMS_PER_PAGE, 25);
  assert.equal(resolveQuotaPagedPageSize(3, 99), 25);
});
