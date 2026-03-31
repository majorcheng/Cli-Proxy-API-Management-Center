import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/features/authFiles/uiState.ts', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  DEFAULT_AUTH_FILES_COMPACT_MODE,
  resolveAuthFilesCompactMode,
} = await import(moduleUrl);

test('认证文件页默认使用简略模式', () => {
  assert.equal(DEFAULT_AUTH_FILES_COMPACT_MODE, true);
  assert.equal(resolveAuthFilesCompactMode(null), true);
  assert.equal(resolveAuthFilesCompactMode({}), true);
});

test('已保存的展示模式仍然优先于默认值', () => {
  assert.equal(resolveAuthFilesCompactMode({ compactMode: false }), false);
  assert.equal(resolveAuthFilesCompactMode({ compactMode: true }), true);
});
