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

test('请求日志会读取 usage 明细中的 reasoning_effort 并回退为短横线', () => {
  assert.match(requestLogsSource, /detail\.reasoning_effort\?\.trim\(\) \|\| ''/);
  assert.match(requestLogsSource, /formatReasoningEffortDisplay\(entry\.reasoningEffort\)/);
});

test('请求日志中英文文案包含思考档位列表头', () => {
  assert.equal(zhLocale.monitor.logs.header_reasoning_effort, '思考档位');
  assert.equal(enLocale.monitor.logs.header_reasoning_effort, 'Effort');
});

test('请求日志表格为思考档位列同步扩展固定列宽', () => {
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_reasoning_effort'\)/);
  assert.match(monitorPageStyles, /th:nth-child\(2\), td:nth-child\(2\)\s*\{\s*width:\s*80px;\s*\}/);
});
