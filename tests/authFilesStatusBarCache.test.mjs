import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const usageStubSource = `
export const normalizeAuthIndex = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(Math.trunc(numberValue)) : null;
};

export const calculateStatusBarData = (details) => ({
  total: details.length,
  ids: details.map((detail) => String(detail.id)).join(',')
});
`;

const usageStubUrl = `data:text/javascript;base64,${Buffer.from(usageStubSource).toString('base64')}`;

const sourcePath = new URL('../src/features/authFiles/statusBarCache.ts', import.meta.url);
const sourceCode = (await readFile(sourcePath, 'utf8')).replace(
  /from ['"]@\/utils\/usage['"]/g,
  `from '${usageStubUrl}'`,
);
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { buildAuthFilesStatusBarCache } = await import(moduleUrl);

test('状态条缓存会先按 auth_index 建索引，再按唯一凭证索引回填结果', () => {
  const files = [
    { name: 'a.json', auth_index: 1 },
    { name: 'b.json', authIndex: 1 },
    { name: 'c.json', auth_index: '2' },
    { name: 'd.json' },
  ];
  const usageDetails = [
    { id: 'u1', auth_index: 1 },
    { id: 'u2', auth_index: '1' },
    { id: 'u3', auth_index: 2 },
    { id: 'u4', auth_index: 3 },
  ];

  const cache = buildAuthFilesStatusBarCache(files, usageDetails);

  assert.equal(cache.size, 2);
  assert.deepEqual(cache.get('1'), { total: 2, ids: 'u1,u2' });
  assert.deepEqual(cache.get('2'), { total: 1, ids: 'u3' });
});
