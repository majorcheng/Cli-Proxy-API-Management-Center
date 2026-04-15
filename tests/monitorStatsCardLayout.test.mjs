import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const channelStatsSource = await readFile(
  new URL('../src/components/monitor/ChannelStats.tsx', import.meta.url),
  'utf8',
);

const apiDetailsStatsSource = await readFile(
  new URL('../src/components/monitor/ApiDetailsStatsCard.tsx', import.meta.url),
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

test('监控中心统计卡片按 5 条渠道视图统一收口高度，渠道统计使用内部滚动承接展开内容', () => {
  assert.match(channelStatsSource, /className=\{styles\.monitorStatsCard\}/);
  assert.match(apiDetailsStatsSource, /compact/);
  assert.match(apiDetailsStatsSource, /cardClassName=\{styles\.monitorApiDetailsCard\}/);
  assert.match(
    channelStatsSource,
    /className=\{`\$\{styles\.tableWrapper\} \$\{styles\.monitorStatsTableWrapper\}`\}/,
  );
  assert.match(monitorPageStyles, /\.monitorStatsCard\s*\{[\s\S]*height:\s*430px;/);
  assert.match(
    monitorPageStyles,
    /\.monitorApiDetailsCard\s*\{[\s\S]*--details-card-height:\s*430px;[\s\S]*--details-card-height-mobile:\s*360px;[\s\S]*padding:\s*16px;/,
  );
  assert.match(
    monitorPageStyles,
    /\.monitorStatsTableWrapper\s*\{[\s\S]*overflow:\s*auto;[\s\S]*overscroll-behavior:\s*auto;/,
  );
});

test('API 详细统计滚动容器允许滚轮继续传递给外层页面', () => {
  assert.match(
    usagePageStyles,
    /\.detailsFixedCard\s*\{[\s\S]*--details-card-height:\s*520px;[\s\S]*height:\s*var\(--details-card-height\);/,
  );
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.doesNotMatch(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(usagePageStyles, /\.detailsScroll\s*\{[\s\S]*overscroll-behavior:\s*auto;/);
  assert.match(usagePageStyles, /\.detailsCompactCard\s*\{[\s\S]*\.apiHeader\s*\{[\s\S]*padding:\s*8px;/);
  assert.match(usagePageStyles, /\.detailsCompactCard\s*\{[\s\S]*\.apiMetaBadge,[\s\S]*\.apiBadge\s*\{[\s\S]*font-size:\s*10px;/);
});
