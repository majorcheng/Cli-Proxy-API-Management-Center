import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const constantsModuleUrl = `data:text/javascript;base64,${Buffer.from(
  `export const normalizeProviderKey = (value) => String(value ?? '').trim().toLowerCase();`,
).toString('base64')}`;

const sourcePath = new URL('../src/features/authFiles/sort.ts', import.meta.url);
const sourceCode = (await readFile(sourcePath, 'utf8')).replace(
  /from ['"]@\/features\/authFiles\/constants['"]/g,
  `from '${constantsModuleUrl}'`,
);
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { compareAuthFilesByDefaultSort, resolveFirstRegisteredAtMs } = await import(moduleUrl);

test('认证文件默认排序优先按 first_registered_at 正序，老账号在前', () => {
  const files = [
    { name: 'older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'newer.json', provider: 'codex', first_registered_at: '2026-03-03T00:00:00Z' },
    { name: 'middle.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['older.json', 'middle.json', 'newer.json'],
  );
});

test('默认排序兼容秒级时间戳和 camelCase firstRegisteredAt', () => {
  const files = [
    { name: 'iso.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
    { name: 'seconds.json', provider: 'codex', first_registered_at: 1772496000 },
    { name: 'camel.json', provider: 'codex', firstRegisteredAt: '1772582400' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['iso.json', 'seconds.json', 'camel.json'],
  );
  assert.equal(resolveFirstRegisteredAtMs(files[2]), 1772582400000);
});

test('缺少首注时间时回退到 provider 和 name，保证排序稳定', () => {
  const files = [
    { name: 'b.json', provider: 'gemini' },
    { name: 'a.json', provider: 'codex' },
    { name: 'c.json', provider: 'codex' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['a.json', 'c.json', 'b.json'],
  );
});

test('缺少首注时间的条目不会被误判成最老账号排到最前面', () => {
  const files = [
    { name: 'unknown.json', provider: 'codex' },
    { name: 'older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'newer.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['older.json', 'newer.json', 'unknown.json'],
  );
});
