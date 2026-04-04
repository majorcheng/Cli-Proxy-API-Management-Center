import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const channelStatsSource = await readFile(
  new URL('../src/components/monitor/ChannelStats.tsx', import.meta.url),
  'utf8',
);

const monitorPageStyles = await readFile(
  new URL('../src/pages/MonitorPage.module.scss', import.meta.url),
  'utf8',
);

const usagePageStyles = await readFile(
  new URL('../src/pages/UsagePage.module.scss', import.meta.url),
  'utf8',
);

test('监控中心统计卡片保持同高，渠道统计使用内部滚动承接展开内容', () => {
  assert.match(channelStatsSource, /className=\{styles\.monitorStatsCard\}/);
  assert.match(
    channelStatsSource,
    /className=\{`\$\{styles\.tableWrapper\} \$\{styles\.monitorStatsTableWrapper\}`\}/,
  );
  assert.match(monitorPageStyles, /\.monitorStatsCard\s*\{[\s\S]*height:\s*520px;/);
  assert.match(
    monitorPageStyles,
    /\.monitorStatsTableWrapper\s*\{[\s\S]*overflow:\s*auto;[\s\S]*overscroll-behavior:\s*auto;/,
  );
});

test('API 详细统计滚动容器允许滚轮继续传递给外层页面', () => {
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.doesNotMatch(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overscroll-behavior:\s*auto;/);
});
