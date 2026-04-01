import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const channelStatsSource = await readFile(
  new URL('../src/components/monitor/ChannelStats.tsx', import.meta.url),
  'utf8',
);

test('渠道统计默认最多展示 8 个渠道，便于与左侧卡片保持横向高度接近', () => {
  assert.match(channelStatsSource, /\.slice\(0, 8\);/);
});
