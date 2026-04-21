import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requestLogsSource = await readFile(
  new URL('../src/components/monitor/RequestLogs.tsx', import.meta.url),
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

test('请求日志会把模型名与 reasoning_effort 合并显示', () => {
  assert.match(requestLogsSource, /const formatModelWithEffort = \(model: string, reasoningEffort: string\) =>/);
  assert.ok(
    requestLogsSource.includes('return normalizedEffort ? `${normalizedModel}(${normalizedEffort})` : normalizedModel;'),
  );
  assert.match(requestLogsSource, /const getStatusPillClassName = \(failed: boolean\) =>/);
  assert.match(requestLogsSource, /const modelDisplay = formatModelWithEffort\(entry\.model, entry\.reasoningEffort\)/);
  assert.match(requestLogsSource, /className=\{getStatusPillClassName\(entry\.failed\)\}/);
});

test('请求日志保留最近历史请求状态条', () => {
  assert.match(requestLogsSource, /const precomputedStats = useMemo\(\(\) =>/);
  assert.match(requestLogsSource, /stats\.recentRequests\.map/);
  assert.match(requestLogsSource, /className=\{`\$\{styles\.statusBar\} \$\{req\.failed \? styles\.failure : styles\.success\}`\}/);
});

test('请求日志会基于统一价格表计算金额，并对未定价模型显示占位符', () => {
  assert.match(requestLogsSource, /const modelPrices = useMemo\(\(\) => loadModelPrices\(\), \[\]\);/);
  assert.match(requestLogsSource, /const cost = modelPrices\[modelName\]/);
  assert.match(requestLogsSource, /calculateCost\(/);
  assert.match(requestLogsSource, /const formatRequestCost = \(cost: number \| null\) =>/);
  assert.match(requestLogsSource, /return '--';/);
  assert.match(requestLogsSource, /minimumFractionDigits:\s*4/);
  assert.match(requestLogsSource, /maximumFractionDigits:\s*4/);
  assert.match(requestLogsSource, /formatRequestCost\(entry\.cost\)/);
});

test('请求日志中英文文案包含金额列表头', () => {
  assert.equal(zhLocale.monitor.logs.header_cost, '金额');
  assert.equal(enLocale.monitor.logs.header_cost, 'Cost');
});

test('请求日志表格按指定排障顺序同步调整列宽', () => {
  assert.doesNotMatch(requestLogsSource, /t\('monitor\.logs\.header_reasoning_effort'\)/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_cost'\)/);
  assert.match(monitorPageStyles, /\.virtualTable\s*\{[\s\S]*min-width:\s*1400px;/);
  assert.match(monitorPageStyles, /th:nth-child\(1\), td:nth-child\(1\)\s*\{\s*width:\s*50px;\s*\}/);
  assert.match(monitorPageStyles, /th:nth-child\(2\), td:nth-child\(2\)\s*\{\s*width:\s*50px;\s*\}/);
  assert.match(monitorPageStyles, /th:nth-child\(3\), td:nth-child\(3\)\s*\{\s*width:\s*80px;\s*\}/);
  assert.match(monitorPageStyles, /\.modelStatusPill\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/);
  assert.match(monitorPageStyles, /th:nth-child\(7\), td:nth-child\(7\)\s*\{\s*width:\s*50px;\s*\}/);
  assert.match(monitorPageStyles, /th:nth-child\(11\), td:nth-child\(11\)\s*\{\s*width:\s*150px;\s*\}/);
});
