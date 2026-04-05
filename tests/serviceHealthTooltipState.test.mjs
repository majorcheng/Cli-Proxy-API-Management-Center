import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/components/usage/serviceHealthTooltipState.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { resolveServiceHealthTooltipIndex } = await import(moduleUrl);

test('合法 tooltip 索引保持不变', () => {
  assert.equal(resolveServiceHealthTooltipIndex(0, 3), 0);
  assert.equal(resolveServiceHealthTooltipIndex(2, 3), 2);
});

test('空值、负数、越界或非整数索引会被清空', () => {
  assert.equal(resolveServiceHealthTooltipIndex(null, 3), null);
  assert.equal(resolveServiceHealthTooltipIndex(-1, 3), null);
  assert.equal(resolveServiceHealthTooltipIndex(3, 3), null);
  assert.equal(resolveServiceHealthTooltipIndex(1.5, 3), null);
});
