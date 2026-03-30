import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/utils/monitorTokenUnit.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  MONITOR_TOKEN_UNIT_DIVISOR,
  MONITOR_TOKEN_UNIT_SUFFIX,
  convertMonitorTokensToDisplayValue,
  formatMonitorTokenDisplayValue,
  getMonitorTokenAxisTitle,
} = await import(moduleUrl);

test('监控中心 Token 图表默认单位固定为 M', () => {
  assert.equal(MONITOR_TOKEN_UNIT_DIVISOR, 1_000_000);
  assert.equal(MONITOR_TOKEN_UNIT_SUFFIX, 'M');
});

test('原始 Token 会按百万单位换算为图表展示值', () => {
  assert.equal(convertMonitorTokensToDisplayValue(1_500_000), 1.5);
  assert.equal(convertMonitorTokensToDisplayValue(250_000), 0.25);
});

test('格式化后的 tooltip 和坐标轴文本会携带 M 后缀', () => {
  assert.equal(formatMonitorTokenDisplayValue(1.5), '1.5M');
  assert.equal(formatMonitorTokenDisplayValue(2), '2M');
  assert.equal(getMonitorTokenAxisTitle('Tokens'), 'Tokens (M)');
});

test('异常数值会安全回退为 0M', () => {
  assert.equal(convertMonitorTokensToDisplayValue(Number.NaN), 0);
  assert.equal(formatMonitorTokenDisplayValue(Number.POSITIVE_INFINITY), '0M');
});
