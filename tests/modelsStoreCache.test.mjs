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

const modelsApiStubUrl = toDataUrl(`
  export const calls = [];
  export const modelsApi = {
    async fetchModels(apiBase, apiKey) {
      calls.push({ apiBase, apiKey });
      return [{ name: \`\${apiBase}::\${apiKey ?? ''}\` }];
    }
  };
`);

const constantsStubUrl = toDataUrl(`
  export const CACHE_EXPIRY_MS = 60_000;
`);

const sourcePath = new URL('../src/stores/useModelsStore.ts', import.meta.url);
let sourceCode = await readFile(sourcePath, 'utf8');
sourceCode = replaceImport(sourceCode, /from ['"]zustand['"]/g, `from '${zustandStubUrl}'`);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/services\/api\/models['"]/g,
  `from '${modelsApiStubUrl}'`
);
sourceCode = replaceImport(
  sourceCode,
  /from ['"]@\/utils\/constants['"]/g,
  `from '${constantsStubUrl}'`
);

const moduleUrl = toDataUrl(transpileTs(sourceCode));
const { useModelsStore } = await import(moduleUrl);
const { calls } = await import(modelsApiStubUrl);

test('模型缓存会按 apiBase + apiKey 共同隔离', async () => {
  calls.length = 0;
  useModelsStore.getState().clearCache();

  await useModelsStore.getState().fetchModels('https://example.com', ' key-a ');
  await useModelsStore.getState().fetchModels('https://example.com', 'key-a');
  await useModelsStore.getState().fetchModels('https://example.com', 'key-b');

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { apiBase: 'https://example.com', apiKey: 'key-a' });
  assert.deepEqual(calls[1], { apiBase: 'https://example.com', apiKey: 'key-b' });
});

test('clearCache 会清空模型列表与缓存快照', async () => {
  useModelsStore.getState().clearCache();
  await useModelsStore.getState().fetchModels('https://example.com', 'key-a');

  assert.ok(useModelsStore.getState().cache);
  assert.equal(useModelsStore.getState().models.length, 1);

  useModelsStore.getState().clearCache();

  assert.equal(useModelsStore.getState().cache, null);
  assert.deepEqual(useModelsStore.getState().models, []);
});
