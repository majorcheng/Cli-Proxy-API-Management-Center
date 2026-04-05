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

test('请求日志在输入和输出之间展示命中 Token 与百分比', () => {
  assert.match(requestLogsSource, /extractMonitorHitTokens\(detail\.tokens\)/);
  assert.match(requestLogsSource, /calculateMonitorHitRate\(inputTokens, hitTokens\)/);
  assert.match(requestLogsSource, /formatHitDisplay\(entry\.hitTokens, entry\.hitRate\)/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_hit'\)/);
});

test('请求日志中英文文案包含命中百分比列表头', () => {
  assert.equal(zhLocale.monitor.logs.header_hit, '命中（百分比）');
  assert.equal(enLocale.monitor.logs.header_hit, 'Hit (%)');
});

test('请求日志表格为命中列同步扩展固定列宽，避免右侧留白', () => {
  assert.match(monitorPageStyles, /\.virtualTable\s*\{[\s\S]*min-width:\s*1450px;/);
  assert.match(monitorPageStyles, /th:nth-child\(12\), td:nth-child\(12\)\s*\{\s*width:\s*130px;\s*\}/);
  assert.match(monitorPageStyles, /th:nth-child\(15\), td:nth-child\(15\)\s*\{\s*width:\s*150px;\s*\}/);
});
