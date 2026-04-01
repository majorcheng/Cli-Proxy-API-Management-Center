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

const zustandStubUrl = toDataUrl(`
  export const create = (initializer) => {
    let state;
    const getState = () => state;
    const setState = (update) => {
      const partial = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...partial };
    };
    state = initializer(setState, getState);
    return { getState, setState };
  };
`);

const configApiStubUrl = toDataUrl(`
  export const deferred = {};
  export const configApi = {
    getConfig() {
      return new Promise((resolve) => {
        deferred.resolve = resolve;
      });
    }
  };
`);

const constantsStubUrl = toDataUrl(`
  export const CACHE_EXPIRY_MS = 60_000;
`);

const sourcePath = new URL('../src/stores/useConfigStore.ts', import.meta.url);
let sourceCode = await readFile(sourcePath, 'utf8');
sourceCode = replaceImport(sourceCode, /from ['"]zustand['"]/g, `from '${zustandStubUrl}'`);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/services\/api\/config['"]/g,
  `from '${configApiStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/utils\/constants['"]/g,
  `from '${constantsStubUrl}'`
);

const moduleUrl = toDataUrl(transpileTs(sourceCode));
const { useConfigStore } = await import(moduleUrl);
const { deferred } = await import(configApiStubUrl);

test('section 更新会废弃更早发出的全量配置请求，避免旧响应覆盖新值', async () => {
  useConfigStore.setState({
    config: null,
    cache: new Map(),
    loading: false,
    error: null,
  });

  const localDebug = { enabled: 'local' };
  const staleDebug = { enabled: 'server' };

  useConfigStore.getState().updateConfigValue('debug', localDebug);
  const pendingFetch = useConfigStore.getState().fetchConfig(undefined, true);

  useConfigStore.getState().updateConfigValue('debug', { enabled: 'new-local' });
  deferred.resolve({
    debug: staleDebug,
    raw: { debug: staleDebug },
  });

  await pendingFetch;

  assert.deepEqual(useConfigStore.getState().config?.debug, { enabled: 'new-local' });
  assert.equal(useConfigStore.getState().loading, false);
  assert.equal(useConfigStore.getState().error, null);
});
