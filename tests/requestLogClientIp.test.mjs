import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/utils/requestLogClientIp.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { normalizeRequestClientIp } = await import(moduleUrl);

test('保留标准 IPv4 地址', () => {
  assert.equal(normalizeRequestClientIp('192.168.1.99'), '192.168.1.99');
});

test('去掉 IPv4-mapped IPv6 的 ::ffff: 前缀', () => {
  assert.equal(normalizeRequestClientIp('::ffff:124.64.232.12'), '124.64.232.12');
});

test('真实 IPv6 地址保持原样', () => {
  assert.equal(normalizeRequestClientIp('2001:db8::1'), '2001:db8::1');
});

test('空白值返回 null', () => {
  assert.equal(normalizeRequestClientIp('   '), null);
});
