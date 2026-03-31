import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../src/components/monitor/RequestLogs.tsx', import.meta.url);
const sourceCode = await readFile(sourcePath, 'utf8');

test('请求日志卡片不再渲染独立时间范围选择器', () => {
  assert.ok(!sourceCode.includes('<TimeRangeSelector'));
  assert.ok(!sourceCode.includes('formatTimeRangeCaption('));
});

test('请求日志副标题只保留最近显示条数与滚动提示', () => {
  assert.ok(sourceCode.includes("t('monitor.logs.total_count', { count: visibleEntries.length })"));
  assert.ok(sourceCode.includes("t('monitor.logs.scroll_hint')"));
});
