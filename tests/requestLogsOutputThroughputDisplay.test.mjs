import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requestLogsSource = await readFile(
  new URL('../src/components/monitor/RequestLogs.tsx', import.meta.url),
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

test('请求日志会基于 output_tokens 和 latency_ms 计算输出速率', () => {
  assert.match(requestLogsSource, /calculateOutputThroughput\(/);
  assert.match(requestLogsSource, /formatOutputThroughput\(entry\.outputThroughput, i18n\.language\)/);
  assert.match(throughputSource, /return \(normalizedOutputTokens \* 1000\) \/ normalizedLatencyMs;/);
});

test('请求日志中英文文案包含输出速率列表头', () => {
  assert.equal(zhLocale.monitor.logs.header_output_throughput, '请求速度');
  assert.equal(enLocale.monitor.logs.header_output_throughput, 'Request Speed');
});

test('请求日志表格把成功率列替换为输出速率列并同步扩展列宽', () => {
  assert.doesNotMatch(requestLogsSource, /t\('monitor\.logs\.header_rate'\)/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_output_throughput'\)/);
  assert.match(monitorPageStyles, /\.virtualTable\s*\{[\s\S]*min-width:\s*1400px;/);
  assert.match(monitorPageStyles, /th:nth-child\(5\), td:nth-child\(5\)\s*\{\s*width:\s*50px;\s*\}/);
});
