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

const headersSourcePath = new URL('../src/utils/headers.ts', import.meta.url);
const headersSourceCode = await readFile(headersSourcePath, 'utf8');
const headersModuleUrl = toDataUrl(transpileTs(headersSourceCode));
const headersModule = await import(headersModuleUrl);

const axiosStubUrl = toDataUrl(`
  export const calls = [];
  const axios = {
    async get(url, config = {}) {
      calls.push({ url, headers: config.headers ?? {} });
      return { data: { data: [{ id: 'stub-model' }] } };
    }
  };
  export default axios;
`);

const modelUtilsStubUrl = toDataUrl(`
  export const normalizeModelList = (payload) => payload;
`);

const connectionStubUrl = toDataUrl(`
  export const normalizeApiBase = (value) => String(value ?? '').trim();
`);

const apiCallStubUrl = toDataUrl(`
  export const calls = [];
  export const apiCallApi = {
    async request({ url, header }) {
      calls.push({ url, header: header ?? {} });
      return { statusCode: 200, body: [{ id: 'stub-model' }] };
    }
  };
  export const getApiCallErrorMessage = () => 'api-call failed';
`);

const modelsSourcePath = new URL('../src/services/api/models.ts', import.meta.url);
let modelsSourceCode = await readFile(modelsSourcePath, 'utf8');
modelsSourceCode = replaceImport(
  modelsSourceCode,
  /from ['"]axios['"]/g,
  `from '${axiosStubUrl}'`
);
modelsSourceCode = replaceImport(
  modelsSourceCode,
  /from ['"]@\/utils\/models['"]/g,
  `from '${modelUtilsStubUrl}'`
);
modelsSourceCode = replaceImport(
  modelsSourceCode,
  /from ['"]@\/utils\/connection['"]/g,
  `from '${connectionStubUrl}'`
);
modelsSourceCode = replaceImport(
  modelsSourceCode,
  /from ['"]@\/utils\/headers['"]/g,
  `from '${headersModuleUrl}'`
);
modelsSourceCode = replaceImport(
  modelsSourceCode,
  /from ['"]\.\/apiCall['"]/g,
  `from '${apiCallStubUrl}'`
);

const modelsModuleUrl = toDataUrl(transpileTs(modelsSourceCode));
const modelsModule = await import(modelsModuleUrl);
const axiosStub = await import(axiosStubUrl);
const apiCallStub = await import(apiCallStubUrl);

test('hasHeader 对请求头键名大小写不敏感', () => {
  assert.equal(headersModule.hasHeader({ AUTHORIZATION: 'Bearer x' }, 'authorization'), true);
  assert.equal(headersModule.hasHeader({ authorization: 'Bearer x' }, 'Authorization'), true);
  assert.equal(headersModule.hasHeader({ 'X-Test': '1' }, 'authorization'), false);
});

test('fetchModels 已有任意大小写 Authorization 时不会重复补 Bearer', async () => {
  axiosStub.calls.length = 0;

  await modelsModule.modelsApi.fetchModels('https://example.com', 'server-key', {
    authorization: 'Bearer custom-token',
  });

  assert.equal(axiosStub.calls.length, 1);
  assert.equal(axiosStub.calls[0].headers.authorization, 'Bearer custom-token');
  assert.equal('Authorization' in axiosStub.calls[0].headers, false);
});

test('fetchModelsViaApiCall 已有任意大小写 Authorization 时不会重复补 Bearer', async () => {
  apiCallStub.calls.length = 0;

  await modelsModule.modelsApi.fetchModelsViaApiCall('https://example.com', 'server-key', {
    AUTHORIZATION: 'Bearer custom-token',
  });

  assert.equal(apiCallStub.calls.length, 1);
  assert.equal(apiCallStub.calls[0].header.AUTHORIZATION, 'Bearer custom-token');
  assert.equal('Authorization' in apiCallStub.calls[0].header, false);
});
