import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const utilSource = await readFile(
  new URL('../src/utils/monitorTokenStats.ts', import.meta.url),
  'utf8',
);
const utilTranspiled = ts.transpileModule(utilSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const utilModuleUrl = `data:text/javascript;base64,${Buffer.from(utilTranspiled.outputText).toString('base64')}`;
const { extractMonitorHitTokens, calculateMonitorHitRate } = await import(utilModuleUrl);

const kpiCardsSource = await readFile(
  new URL('../src/components/monitor/KpiCards.tsx', import.meta.url),
  'utf8',
);
const hourlyTokenChartSource = await readFile(
  new URL('../src/components/monitor/HourlyTokenChart.tsx', import.meta.url),
  'utf8',
);

const zhLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8'),
);
const enLocale = JSON.parse(
  await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
);

test('监控中心命中 Token 统计兼容 cached_tokens 与 cache_tokens 字段', () => {
  assert.equal(extractMonitorHitTokens({ cached_tokens: 128 }), 128);
  assert.equal(extractMonitorHitTokens({ cache_tokens: 256 }), 256);
  assert.equal(extractMonitorHitTokens({ cached_tokens: 128, cache_tokens: 256 }), 256);
  assert.equal(extractMonitorHitTokens({ cached_tokens: -1, cache_tokens: 0 }), 0);
});

test('监控中心命中占比按 命中/输入 计算，并限制在 0% 到 100% 之间', () => {
  assert.equal(calculateMonitorHitRate(1000, 250), 0.25);
  assert.equal(calculateMonitorHitRate(0, 250), 0);
  assert.equal(calculateMonitorHitRate(100, 200), 1);
  assert.equal(calculateMonitorHitRate(-1, 20), 0);
});

test('Tokens 卡片与每小时图表源码都接入命中 Token 展示', () => {
  assert.match(kpiCardsSource, /t\('monitor\.kpi\.hit'\)/);
  assert.match(kpiCardsSource, /stats\.hitTokens/);
  assert.match(kpiCardsSource, /stats\.hitRate\.toFixed\(1\)/);

  assert.match(hourlyTokenChartSource, /t\('monitor\.hourly_token\.hit'\)/);
  assert.match(hourlyTokenChartSource, /hourlyData\.hitTokens/);
  assert.match(hourlyTokenChartSource, /extractMonitorHitTokens\(detail\.tokens\)/);
});

test('监控中心中英文文案包含命中 Token 标签', () => {
  assert.equal(zhLocale.monitor.kpi.hit, '命中');
  assert.equal(zhLocale.monitor.hourly_token.hit, '命中');
  assert.equal(enLocale.monitor.kpi.hit, 'Hit');
  assert.equal(enLocale.monitor.hourly_token.hit, 'Hit');
});
