import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const monitorPageSource = await readFile(
  new URL('../src/pages/MonitorPage.tsx', import.meta.url),
  'utf8',
);

test('监控中心中，API 详细统计与渠道统计使用 apiFilteredData，避免与顶部时间范围叠加', () => {
  assert.match(monitorPageSource, /<ApiDetailsStatsCard\s+data=\{apiFilteredData\}\s+loading=\{loading\}/);
  assert.match(monitorPageSource, /<ChannelStats\s+data=\{apiFilteredData\}\s+loading=\{loading\}/);
});
