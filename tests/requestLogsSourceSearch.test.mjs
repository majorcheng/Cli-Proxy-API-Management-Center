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

test('请求日志移除请求渠道下拉筛选并改为搜索框', () => {
  assert.doesNotMatch(requestLogsSource, /filterSource/);
  assert.doesNotMatch(requestLogsSource, /monitor\.logs\.all_sources/);
  assert.match(requestLogsSource, /const \[sourceSearchQuery, setSourceSearchQuery\] = useState\(''\);/);
  assert.match(requestLogsSource, /type="search"/);
  assert.match(requestLogsSource, /placeholder=\{t\('monitor\.logs\.source_search_placeholder'\)\}/);
  assert.match(requestLogsSource, /aria-label=\{t\('monitor\.logs\.source_search_label'\)\}/);
});

test('请求渠道搜索覆盖渠道列的可见名称与链接标题', () => {
  assert.match(requestLogsSource, /const isChannelMatchedBySearch = \(entry: LogEntry, keyword: string\) =>/);
  assert.match(requestLogsSource, /entry\.source,/);
  assert.match(requestLogsSource, /entry\.displayName,/);
  assert.match(requestLogsSource, /entry\.providerName \?\? '',/);
  assert.match(requestLogsSource, /entry\.providerBaseUrl,/);
  assert.match(requestLogsSource, /entry\.maskedKey,/);
  assert.match(requestLogsSource, /isChannelMatchedBySearch\(entry, sourceSearchQuery\)/);
});

test('请求渠道搜索框具备独立样式和中英文文案', () => {
  assert.match(monitorPageStyles, /\.logSearchInput\s*\{[\s\S]*min-width:\s*180px;/);
  assert.equal(zhLocale.monitor.logs.source_search_placeholder, '搜索请求渠道');
  assert.equal(zhLocale.monitor.logs.source_search_label, '搜索请求渠道');
  assert.equal(enLocale.monitor.logs.source_search_placeholder, 'Search request source');
  assert.equal(enLocale.monitor.logs.source_search_label, 'Search request source');
  assert.equal(zhLocale.monitor.logs.all_sources, undefined);
  assert.equal(enLocale.monitor.logs.all_sources, undefined);
});
