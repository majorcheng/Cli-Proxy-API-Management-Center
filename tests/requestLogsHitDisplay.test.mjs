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

test('请求日志把三项 Token 与缓存命中百分比汇总进 TOKEN 列', () => {
  assert.match(requestLogsSource, /extractMonitorHitTokens\(detail\.tokens\)/);
  assert.match(requestLogsSource, /calculateMonitorHitRate\(rawInputTokens, cacheReadTokens\)/);
  assert.match(requestLogsSource, /calculateMonitorNetInputTokens,/);
  assert.match(requestLogsSource, /inputTokens: calculateMonitorNetInputTokens\(rawInputTokens, cacheReadTokens\),/);
  assert.match(requestLogsSource, /cacheReadTokens,/);
  assert.match(requestLogsSource, /hitRate: calculateMonitorHitRate\(rawInputTokens, cacheReadTokens\),/);
  assert.match(requestLogsSource, /const TOKEN_CELL_ITEMS = \[/);
  assert.match(requestLogsSource, /icon: '⬆'/);
  assert.match(requestLogsSource, /icon: '⬇'/);
  assert.match(requestLogsSource, /iconClassName: styles\.tokenMetricInputIcon/);
  assert.match(requestLogsSource, /iconClassName: styles\.tokenMetricOutputIcon/);
  assert.match(requestLogsSource, /iconClassName: styles\.tokenMetricCacheIcon/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_tokens'\)/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_cache_read'\)/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_cache_hit_rate'\)/);
  assert.match(requestLogsSource, /formatHitRate\(entry\.hitRate\)/);
});

test('请求日志中英文文案包含 TOKEN 与缓存命中百分比列表头', () => {
  assert.equal(zhLocale.monitor.logs.header_tokens, 'TOKEN');
  assert.equal(enLocale.monitor.logs.header_tokens, 'TOKEN');
  assert.equal(zhLocale.monitor.logs.header_cache_hit_rate, '缓存命中%');
  assert.equal(enLocale.monitor.logs.header_cache_hit_rate, 'Cache Hit %');
});

test('请求日志表格按新列序同步调整固定列宽', () => {
  assert.match(monitorPageStyles, /\.virtualTable\s*\{[\s\S]*min-width:\s*1400px;/);
  assert.match(monitorPageStyles, /th:nth-child\(6\), td:nth-child\(6\)\s*\{\s*width:\s*130px;\s*\}/);
  assert.match(monitorPageStyles, /\.tokenSummary\s*\{[\s\S]*flex-wrap:\s*wrap;[\s\S]*gap:\s*6px;/);
  assert.match(monitorPageStyles, /\.tokenMetricIcon\s*\{[\s\S]*width:\s*14px;[\s\S]*font-size:\s*14px;[\s\S]*font-weight:\s*700;/);
  assert.match(monitorPageStyles, /\.tokenMetricInput\s*\{[\s\S]*text-primary/);
  assert.match(monitorPageStyles, /\.tokenMetricInputIcon\s*\{[\s\S]*#3b82f6/);
  assert.match(monitorPageStyles, /\.tokenMetricOutput\s*\{[\s\S]*text-primary/);
  assert.match(monitorPageStyles, /\.tokenMetricOutputIcon\s*\{[\s\S]*#8b5cf6/);
  assert.match(monitorPageStyles, /\.tokenMetricCache\s*\{[\s\S]*#1585C6/);
  assert.match(monitorPageStyles, /\.tokenMetricCacheIcon\s*\{[\s\S]*#1585C6/);
  assert.match(monitorPageStyles, /\.tokenMetricHitRate\s*\{[\s\S]*text-primary/);
  assert.match(monitorPageStyles, /th:nth-child\(11\), td:nth-child\(11\)\s*\{\s*width:\s*150px;\s*\}/);
});
