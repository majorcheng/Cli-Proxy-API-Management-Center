import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [openaiSectionSource, aiProvidersPageSource, connectivitySource, zhCnLocaleSource] =
  await Promise.all([
    readFile(
      new URL('../src/components/providers/OpenAISection/OpenAISection.tsx', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/pages/AiProvidersPage.tsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../src/features/openaiProviders/connectivity.ts', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8'),
  ]);

test('OpenAI 列表区为每个 provider 渲染测试按钮，并在测试期间锁住操作', () => {
  assert.match(openaiSectionSource, /isTestingAll\?: boolean;/);
  assert.match(openaiSectionSource, /testingProviderName\?: string \| null;/);
  assert.match(openaiSectionSource, /const actionsDisabled =[\s\S]*isTestingAll \|\| Boolean\(testingProviderName\);/);
  assert.match(openaiSectionSource, /renderLeadingActions=\{\(item, index\) => \(/);
  assert.match(openaiSectionSource, /onClick=\{\(\) => onTest\(index\)\}/);
  assert.match(openaiSectionSource, /loading=\{testingProviderName === item\.name\}/);
  assert.match(openaiSectionSource, /t\('ai_providers\.openai_test_single_action'\)/);
});

test('OpenAI 卡片头部会把测试全部按钮放在添加供应商左边', () => {
  assert.match(openaiSectionSource, /<div className=\{styles\.modelConfigToolbar\}>[\s\S]*?onClick=\{onTestAll\}[\s\S]*?t\('ai_providers\.openai_test_all_action'\)[\s\S]*?onClick=\{onAdd\}[\s\S]*?t\('ai_providers\.openai_add_button'\)/);
});

test('OpenAI 列表测试会复用共享连通性逻辑，并按结果回写优先级', () => {
  assert.match(aiProvidersPageSource, /import \{ runOpenAIAllKeysConnectivityTest \} from '@\/features\/openaiProviders\/connectivity';/);
  assert.match(aiProvidersPageSource, /const \[isTestingAllOpenAIProviders, setIsTestingAllOpenAIProviders\] = useState\(false\);/);
  assert.match(aiProvidersPageSource, /const \[testingOpenAIProviderName, setTestingOpenAIProviderName\] = useState<string \| null>\(null\);/);
  assert.match(aiProvidersPageSource, /const result = await runOpenAIAllKeysConnectivityTest\(/);
  assert.match(aiProvidersPageSource, /onKeyTested: \(keyIndex, keyResult\) => \{/);
  assert.match(aiProvidersPageSource, /showNotification\(message, keyResult\.success \? 'success' : 'error'\);/);
  assert.match(aiProvidersPageSource, /const targetPriority = result\.failCount === 0 \? -10 : -100;/);
  assert.match(aiProvidersPageSource, /providersApi\.patchOpenAIProviderByName\(\s*entry\.name,\s*\{ priority: targetPriority \},\s*openaiRevision,\s*\)/);
  assert.match(aiProvidersPageSource, /showNotification\(\s*t\('notification\.openai_provider_test_priority_updated'/);
});

test('OpenAI 列表支持顺序测试全部 provider 并逐个回写最新 revision', () => {
  assert.match(aiProvidersPageSource, /const testAllOpenaiProviders = useCallback\(async \(\) => \{/);
  assert.match(aiProvidersPageSource, /for \(const entry of openaiProviders\) \{/);
  assert.match(aiProvidersPageSource, /let currentRevision = openaiRevision;/);
  assert.match(aiProvidersPageSource, /currentRevision = state\.revision;/);
  assert.match(aiProvidersPageSource, /showNotification\(t\('notification\.openai_provider_test_all_completed'\), 'success'\);/);
  assert.match(aiProvidersPageSource, /onTestAll=\{\(\) => void testAllOpenaiProviders\(\)\}/);
});

test('共享 OpenAI 连通性测试模块统一暴露单 key 与全部 key 逻辑', () => {
  assert.match(connectivitySource, /export const OPENAI_TEST_TIMEOUT_MS = 30_000;/);
  assert.match(connectivitySource, /export const resolveOpenAIConnectivityTestContext = \(/);
  assert.match(connectivitySource, /export async function runOpenAISingleKeyConnectivityTest\(/);
  assert.match(connectivitySource, /export async function runOpenAIAllKeysConnectivityTest\(/);
  assert.match(connectivitySource, /onKeyTested\?: \(/);
  assert.match(connectivitySource, /onKeyTested\?\.\(keyIndex, \{ \.\.\.finalStatus, success \}\);/);
  assert.match(connectivitySource, /notificationType: 'success' \| 'warning' \| 'error';/);
});

test('OpenAI 列表测试成功后会提示优先级回写结果文案', () => {
  assert.match(zhCnLocaleSource, /"openai_provider_test_priority_updated": "测试完成，优先级已更新为 \{\{priority\}\}。\{\{result\}\}"/);
  assert.match(zhCnLocaleSource, /"openai_provider_test_all_completed": "全部 OpenAI 兼容提供商测试完成"/);
});
