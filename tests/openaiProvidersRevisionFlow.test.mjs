import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [providersApiSource, openaiEditLayoutSource, aiProvidersPageSource] = await Promise.all([
  readFile(new URL('../src/services/api/providers.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/AiProvidersOpenAIEditLayout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/AiProvidersPage.tsx', import.meta.url), 'utf8'),
]);

test('OpenAI provider API 提供带 revision 的状态接口与单项 CRUD', () => {
  assert.match(providersApiSource, /async getOpenAIProvidersState\(\): Promise<OpenAIProvidersState>/);
  assert.match(providersApiSource, /async createOpenAIProvider\(\s*value: OpenAIProviderConfig,\s*revision: string\s*\)/);
  assert.match(providersApiSource, /async patchOpenAIProviderByName\(\s*matchName: string,[\s\S]*revision: string\s*\)/);
  assert.match(providersApiSource, /async deleteOpenAIProvider\(name: string, revision: string\)/);
  assert.match(providersApiSource, /data: \{ name, revision \}/);
  assert.match(providersApiSource, /matchName,/);
  assert.doesNotMatch(providersApiSource, /patchOpenAIProviderByName:\s*\(name: string, value: Partial<OpenAIProviderConfig>\)/);
});

test('OpenAI 编辑页改为单项 create\/patch 并使用 revision 回填最新列表', () => {
  assert.match(openaiEditLayoutSource, /const \[revision, setRevision\] = useState\(''\);/);
  assert.match(openaiEditLayoutSource, /const refreshOpenAIProviders = useCallback\(async \(\) => \{/);
  assert.match(openaiEditLayoutSource, /providersApi\.getOpenAIProvidersState\(\)/);
  assert.match(openaiEditLayoutSource, /providersApi\.patchOpenAIProviderByName\(initialData\.name, payload, revision\)/);
  assert.match(openaiEditLayoutSource, /providersApi\.createOpenAIProvider\(payload, revision\)/);
  assert.doesNotMatch(openaiEditLayoutSource, /providersApi\.saveOpenAIProviders\(nextList\)/);
});

test('OpenAI 列表页删除以后使用服务端返回列表，不再本地 filter 假成功', () => {
  assert.match(aiProvidersPageSource, /const \[openaiRevision, setOpenaiRevision\] = useState\(''\);/);
  assert.match(aiProvidersPageSource, /providersApi\.getOpenAIProvidersState\(\)/);
  assert.match(aiProvidersPageSource, /const state = await providersApi\.deleteOpenAIProvider\(entry\.name, openaiRevision\);/);
  assert.match(aiProvidersPageSource, /setOpenaiProviders\(state\.items\);/);
  assert.doesNotMatch(aiProvidersPageSource, /const next = openaiProviders\.filter\(\(_, idx\) => idx !== index\);/);
});
