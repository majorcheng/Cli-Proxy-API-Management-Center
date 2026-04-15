import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chartSource = await readFile(
  new URL('../src/components/monitor/ModelDistributionChart.tsx', import.meta.url),
  'utf8',
);
const throughputSource = await readFile(
  new URL('../src/utils/monitorThroughput.ts', import.meta.url),
  'utf8',
);
const monitorPageStyles = await readFile(
  new URL('../src/pages/MonitorPage.module.scss', import.meta.url),
  'utf8',
);

const zhLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8'),
);
const enLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
);

test('模型用量分布卡片新增输出速率第三视图，并复用统一聚合口径', () => {
  assert.match(chartSource, /type ViewMode = 'request' \| 'token' \| 'throughput';/);
  assert.match(chartSource, /buildModelDistributionMetrics\(data\)/);
  assert.match(chartSource, /t\('monitor\.distribution\.output_throughput'\)/);
  assert.match(throughputSource, /throughputSampleCount > 0\s*\?\s*\(accumulator\.outputTokens \* 1000\) \/ accumulator\.latencyMs/);
});

test('输出速率视图改为榜单展示，并显示有效样本数', () => {
  assert.match(chartSource, /viewMode === 'throughput' \? \(/);
  assert.match(chartSource, /className=\{styles\.rankingList\}/);
  assert.match(chartSource, /t\('monitor\.distribution\.valid_samples', \{ count: item\.throughputSampleCount \}\)/);
  assert.match(monitorPageStyles, /\.rankingList\s*\{/);
  assert.match(monitorPageStyles, /\.rankingItem\s*\{/);
});

test('模型用量分布中英文文案包含输出速率视图', () => {
  assert.equal(zhLocale.monitor.distribution.output_throughput, '输出速率');
  assert.equal(zhLocale.monitor.distribution.by_output_throughput, '按输出速率');
  assert.equal(enLocale.monitor.distribution.output_throughput, 'Output Throughput');
  assert.equal(enLocale.monitor.distribution.by_output_throughput, 'By Output Throughput');
});
