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
  readAuthFilesUiState,
  writeAuthFilesUiState,
} = await import(moduleUrl);

const AUTH_FILES_UI_STATE_KEY = 'authFilesPage.uiState';

const createStorageMock = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    dump() {
      return Object.fromEntries(data.entries());
    },
  };
};

const withMockWindow = async ({ local = {}, session = {} }, fn) => {
  const previousWindow = globalThis.window;
  const windowMock = {
    localStorage: createStorageMock(local),
    sessionStorage: createStorageMock(session),
  };
  globalThis.window = windowMock;
  try {
    await fn(windowMock);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
};

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

test('读取 UI 状态时优先使用 localStorage，缺失时回退 sessionStorage', async () => {
  const localState = { filter: 'codex', availableOnly: true };
  const sessionState = { filter: 'gemini', problemOnly: true };

  await withMockWindow(
    {
      local: { [AUTH_FILES_UI_STATE_KEY]: JSON.stringify(localState) },
      session: { [AUTH_FILES_UI_STATE_KEY]: JSON.stringify(sessionState) },
    },
    async () => {
      assert.deepEqual(readAuthFilesUiState(), localState);
    }
  );

  await withMockWindow(
    {
      session: { [AUTH_FILES_UI_STATE_KEY]: JSON.stringify(sessionState) },
    },
    async () => {
      assert.deepEqual(readAuthFilesUiState(), sessionState);
    }
  );
});

test('写入 UI 状态时落到 localStorage，并清理旧 sessionStorage 副本', async () => {
  const nextState = { filter: 'claude', disabledOnly: true, page: 3 };

  await withMockWindow(
    {
      session: { [AUTH_FILES_UI_STATE_KEY]: JSON.stringify({ filter: 'old' }) },
    },
    async (windowMock) => {
      writeAuthFilesUiState(nextState);

      assert.equal(
        windowMock.localStorage.getItem(AUTH_FILES_UI_STATE_KEY),
        JSON.stringify(nextState)
      );
      assert.equal(windowMock.sessionStorage.getItem(AUTH_FILES_UI_STATE_KEY), null);
    }
  );
});
