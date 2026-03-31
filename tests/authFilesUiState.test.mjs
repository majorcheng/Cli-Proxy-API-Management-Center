import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const pageSizeSourcePath = new URL('../src/features/authFiles/pageSize.ts', import.meta.url);
const pageSizeSourceCode = await readFile(pageSizeSourcePath, 'utf8');
const pageSizeTranspiled = ts.transpileModule(pageSizeSourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const pageSizeModuleUrl = `data:text/javascript;base64,${Buffer.from(pageSizeTranspiled.outputText).toString('base64')}`;

const sourcePath = new URL('../src/features/authFiles/uiState.ts', import.meta.url);
const sourceCode = (await readFile(sourcePath, 'utf8')).replace(
  /from ['"]@\/features\/authFiles\/pageSize['"]/g,
  `from '${pageSizeModuleUrl}'`,
);
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  DEFAULT_AUTH_FILES_PAGE_SIZE,
  resolvePersistedAuthFilesPageSize,
} = await import(moduleUrl);

test('认证文件页已收口为单一紧凑分页默认值', () => {
  assert.equal(DEFAULT_AUTH_FILES_PAGE_SIZE, 100);
  assert.equal(resolvePersistedAuthFilesPageSize(null), 100);
  assert.equal(resolvePersistedAuthFilesPageSize({}), 100);
});

test('旧会话里自定义的紧凑分页值会优先迁移到新单模式布局', () => {
  assert.equal(resolvePersistedAuthFilesPageSize({ compactPageSize: 18, pageSize: 40 }), 18);
});

test('若旧 compactPageSize 只是历史默认值，则继续回退到其他已保存分页值', () => {
  assert.equal(resolvePersistedAuthFilesPageSize({ compactPageSize: 12, pageSize: 24 }), 24);
  assert.equal(resolvePersistedAuthFilesPageSize({ compactPageSize: 12, regularPageSize: 20 }), 20);
});
