import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const channelStatsSource = await readFile(
  new URL('../src/components/monitor/ChannelStats.tsx', import.meta.url),
  'utf8',
);

test('渠道统计会读取 OpenAI 兼容提供商的 baseUrl 并归一化', () => {
  assert.match(channelStatsSource, /const providerBaseUrl = normalizeOpenAIProviderBaseUrl\(sourceInfo\.baseUrl\);/);
  assert.match(channelStatsSource, /providerBaseUrl,/);
});

test('渠道统计里的 OpenAI 兼容渠道名称会渲染为可点击链接，并阻止展开行误触发', () => {
  assert.match(channelStatsSource, /href=\{stat\.providerBaseUrl\}/);
  assert.match(channelStatsSource, /target="_blank"/);
  assert.match(channelStatsSource, /rel="noreferrer"/);
  assert.match(channelStatsSource, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
});
