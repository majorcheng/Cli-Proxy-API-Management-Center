import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const toDataUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

const transpileTs = (code) =>
  ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

const replaceImport = (code, pattern, replacement) => code.replace(pattern, replacement);

const storageMap = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storageMap.has(key) ? storageMap.get(key) : null;
  },
  setItem(key, value) {
    storageMap.set(key, String(value));
  },
  removeItem(key) {
    storageMap.delete(key);
  },
  clear() {
    storageMap.clear();
  },
};

const zustandStubUrl = toDataUrl(`
  const createStore = (initializer) => {
    let state;
    const getState = () => state;
    const setState = (update) => {
      const partial = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...partial };
    };
    state = initializer(setState, getState);
    return { getState, setState };
  };
  export const create = (initializer) =>
    typeof initializer === 'function' ? createStore(initializer) : (nextInitializer) => createStore(nextInitializer);
`);

const middlewareStubUrl = toDataUrl(`
  export const persist = (initializer) => initializer;
  export const createJSONStorage = (getStorage) => getStorage;
`);

const constantsStubUrl = toDataUrl(`
  export const STORAGE_KEY_AUTH = 'auth-store-test';
`);

const secureStorageStubUrl = toDataUrl(`
  export const secureStorage = {
    migratePlaintextKeys() {},
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
`);

const apiClientStubUrl = toDataUrl(`
  export const configCalls = [];
  export const apiClient = {
    setConfig(config) {
      configCalls.push(config);
    }
  };
`);

const configStoreStubUrl = toDataUrl(`
  export const counters = { fetchConfig: 0, clearCache: 0 };
  export const useConfigStore = {
    getState() {
      return {
        async fetchConfig() {
          counters.fetchConfig += 1;
          return {};
        },
        clearCache() {
          counters.clearCache += 1;
        }
      };
    }
  };
`);

const modelsStoreStubUrl = toDataUrl(`
  export const counters = { clearCache: 0 };
  export const useModelsStore = {
    getState() {
      return {
        clearCache() {
          counters.clearCache += 1;
        }
      };
    }
  };
`);

const usageStoreStubUrl = toDataUrl(`
  export const counters = { clearUsageStats: 0 };
  export const useUsageStatsStore = {
    getState() {
      return {
        clearUsageStats() {
          counters.clearUsageStats += 1;
        }
      };
    }
  };
`);

const connectionStubUrl = toDataUrl(`
  export const detectApiBaseFromLocation = () => '';
  export const normalizeApiBase = (value) => String(value ?? '').trim();
`);

const sourcePath = new URL('../src/stores/useAuthStore.ts', import.meta.url);
let sourceCode = await readFile(sourcePath, 'utf8');
sourceCode = replaceImport(sourceCode, /from ['"]zustand['"]/g, `from '${zustandStubUrl}'`);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]zustand\/middleware['"]/g,
  `from '${middlewareStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/utils\/constants['"]/g,
  `from '${constantsStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/services\/storage\/secureStorage['"]/g,
  `from '${secureStorageStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/services\/api\/client['"]/g,
  `from '${apiClientStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]\.\/useConfigStore['"]/g,
  `from '${configStoreStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]\.\/useModelsStore['"]/g,
  `from '${modelsStoreStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]\.\/useUsageStatsStore['"]/g,
  `from '${usageStoreStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/utils\/connection['"]/g,
  `from '${connectionStubUrl}'`
);

const moduleUrl = toDataUrl(transpileTs(sourceCode));
const { useAuthStore } = await import(moduleUrl);
const modelsCounters = await import(modelsStoreStubUrl);
const configCounters = await import(configStoreStubUrl);
const usageCounters = await import(usageStoreStubUrl);

test('登录与登出都会清空模型缓存，避免跨连接沿用旧模型列表', async () => {
  storageMap.clear();
  modelsCounters.counters.clearCache = 0;
  configCounters.counters.clearCache = 0;
  configCounters.counters.fetchConfig = 0;
  usageCounters.counters.clearUsageStats = 0;

  await useAuthStore.getState().login({
    apiBase: ' https://example.com ',
    managementKey: ' secret-key ',
    rememberPassword: false,
  });

  assert.equal(modelsCounters.counters.clearCache, 1);
  assert.equal(configCounters.counters.fetchConfig, 1);

  useAuthStore.getState().logout();

  assert.equal(modelsCounters.counters.clearCache, 2);
  assert.equal(configCounters.counters.clearCache, 1);
  assert.equal(usageCounters.counters.clearUsageStats, 1);
});
