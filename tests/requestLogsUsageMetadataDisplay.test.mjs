import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requestLogsSource = await readFile(
  new URL('../src/components/monitor/RequestLogs.tsx', import.meta.url),
  'utf8'
);
const monitorPageSource = await readFile(
  new URL('../src/pages/MonitorPage.tsx', import.meta.url),
  'utf8'
);
const usageUtilsSource = await readFile(new URL('../src/utils/usage.ts', import.meta.url), 'utf8');
const monitorPageStyles = await readFile(
  new URL('../src/pages/MonitorPage.module.scss', import.meta.url),
  'utf8'
);

const zhLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8')
);
const enLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8')
);

test('请求日志接入 usage 明细的类型、首 Token 与 UA 字段', () => {
  assert.match(monitorPageSource, /request_type\?: string;/);
  assert.match(monitorPageSource, /first_token_ms\?: number;/);
  assert.match(monitorPageSource, /user_agent\?: string;/);
  assert.match(usageUtilsSource, /request_type\?: string;/);
  assert.match(usageUtilsSource, /first_token_ms\?: number;/);
  assert.match(usageUtilsSource, /user_agent\?: string;/);
  assert.match(
    requestLogsSource,
    /const requestType = detail\.request_type\?\.trim\(\)\.toLowerCase\(\) \|\| '';/
  );
  assert.match(
    requestLogsSource,
    /const firstTokenMs = normalizeFirstTokenMs\(detail\.first_token_ms\);/
  );
  assert.match(
    requestLogsSource,
    /const userAgent = normalizeUserAgentDisplay\(detail\.user_agent\);/
  );
  assert.match(requestLogsSource, /formatRequestType\(entry\.requestType, t\)/);
  assert.match(requestLogsSource, /formatLatency\(entry\.firstTokenMs\)/);
});

test('请求日志按指定顺序展示类型、首 Token 与 UA 列', () => {
  assert.match(
    requestLogsSource,
    /header_status'\)\}\<\/th\>[\s\S]*header_request_type'\)\}\<\/th\>[\s\S]*header_output_throughput'\)\}\<\/th\>/
  );
  assert.match(
    requestLogsSource,
    /header_cost'\)\}\<\/th\>[\s\S]*header_first_token'\)\}\<\/th\>[\s\S]*header_latency'\)\}\<\/th\>/
  );
  assert.match(requestLogsSource, /header_time'\)\}\<\/th\>[\s\S]*header_user_agent'\)\}\<\/th\>/);
  assert.match(requestLogsSource, /t\('monitor\.logs\.header_provider_type'\)/);
});

test('请求日志中英文文案包含新观测字段和类型枚举', () => {
  assert.equal(zhLocale.monitor.logs.header_request_type, '类型');
  assert.equal(zhLocale.monitor.logs.header_first_token, '首 Token 时间');
  assert.equal(zhLocale.monitor.logs.header_user_agent, 'UA');
  assert.equal(zhLocale.monitor.logs.header_provider_type, '渠道类型');
  assert.equal(zhLocale.monitor.logs.request_type_sync, '同步');
  assert.equal(zhLocale.monitor.logs.request_type_stream, '流式');
  assert.equal(zhLocale.monitor.logs.request_type_websocket, 'WebSocket');
  assert.equal(enLocale.monitor.logs.header_first_token, 'First Token');
  assert.equal(enLocale.monitor.logs.header_provider_type, 'Provider Type');
  assert.equal(enLocale.monitor.logs.request_type_sync, 'Sync');
  assert.equal(enLocale.monitor.logs.request_type_stream, 'Stream');
  assert.equal(enLocale.monitor.logs.request_type_websocket, 'WebSocket');
});

test('请求日志表格为新增列保留固定列宽', () => {
  assert.match(
    monitorPageStyles,
    /th:nth-child\(5\), td:nth-child\(5\)\s*\{\s*width:\s*42px;\s*\}/
  );
  assert.match(
    monitorPageStyles,
    /th:nth-child\(9\), td:nth-child\(9\)\s*\{\s*width:\s*35px;\s*\}/
  );
  assert.match(
    monitorPageStyles,
    /th:nth-child\(14\), td:nth-child\(14\)\s*\{\s*width:\s*130px;\s*\}/
  );
});
