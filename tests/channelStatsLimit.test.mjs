import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const channelStatsSource = await readFile(
  new URL('../src/components/monitor/ChannelStats.tsx', import.meta.url),
  'utf8',
);

test('渠道统计默认最多展示 5 个渠道，避免右侧卡片过高并与左侧 API 详细统计对齐', () => {
  assert.match(channelStatsSource, /const MONITOR_CHANNEL_LIMIT = 5;/);
  assert.match(channelStatsSource, /\.slice\(0, MONITOR_CHANNEL_LIMIT\);/);
});
