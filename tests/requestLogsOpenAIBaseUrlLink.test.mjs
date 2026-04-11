import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requestLogsSource = await readFile(
  new URL('../src/components/monitor/RequestLogs.tsx', import.meta.url),
  'utf8',
);
const sourceResolverSource = await readFile(
  new URL('../src/utils/sourceResolver.ts', import.meta.url),
  'utf8',
);
const monitorPageStyles = await readFile(
  new URL('../src/pages/MonitorPage.module.scss', import.meta.url),
  'utf8',
);

test('OpenAI 兼容渠道会把 baseUrl 归一化为可打开的站点根地址', () => {
  assert.match(sourceResolverSource, /export function normalizeOpenAIProviderBaseUrl\(baseUrl: string \| undefined\): string/);
  assert.ok(sourceResolverSource.includes("normalized = normalized.replace(/\\/chat\\/completions\\/?$/i, '');"));
  assert.ok(sourceResolverSource.includes("normalized = normalized.replace(/\\/models\\/?$/i, '');"));
  assert.ok(sourceResolverSource.includes("normalized = normalized.replace(/\\/v1\\/?$/i, '');"));
});

test('OpenAI 兼容渠道会把 provider.name 也注册进 sourceInfoMap，并保留 baseUrl', () => {
  assert.match(sourceResolverSource, /buildCandidateUsageSourceIds\(\{ prefix: provider\.name \}\)/);
  assert.match(sourceResolverSource, /registerCandidates\(displayName, 'openai', Array\.from\(candidates\), provider\.baseUrl\);/);
});

test('请求日志里的 OpenAI 兼容渠道名称会渲染为可点击链接', () => {
  assert.match(requestLogsSource, /const providerBaseUrl = normalizeOpenAIProviderBaseUrl\(sourceInfo\.baseUrl\);/);
  assert.match(requestLogsSource, /href=\{entry\.providerBaseUrl\}/);
  assert.match(requestLogsSource, /target="_blank"/);
  assert.match(requestLogsSource, /rel="noreferrer"/);
});

test('请求日志为渠道链接补充独立样式，避免表格里出现默认蓝色下划线', () => {
  assert.match(monitorPageStyles, /\.channelLink\s*\{/);
  assert.match(monitorPageStyles, /color:\s*inherit;/);
  assert.match(monitorPageStyles, /text-decoration:\s*underline;/);
});
