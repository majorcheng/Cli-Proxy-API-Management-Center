import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kpiCardsSource = await readFile(
  new URL('../src/components/monitor/KpiCards.tsx', import.meta.url),
  'utf8'
);

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

test('监控中心顶部速率卡已将平均 TPM 与平均 RPM 合并到同一张卡片', () => {
  assert.match(kpiCardsSource, /t\('monitor\.kpi\.avg_rate'\)/);
  assert.match(kpiCardsSource, /className=\{styles\.kpiSplitValue\}/);
  assert.match(kpiCardsSource, /t\('monitor\.kpi\.avg_tpm'\)/);
  assert.match(kpiCardsSource, /t\('monitor\.kpi\.avg_rpm'\)/);
  assert.match(monitorPageStyles, /\.kpiSplitValue\s*\{/);
  assert.match(monitorPageStyles, /\.kpiSplitNumber\s*\{/);
});

test('监控中心顶部新增消费金额卡片，并复用使用统计的价格汇总口径', () => {
  assert.match(kpiCardsSource, /loadModelPrices\(\)/);
  assert.match(kpiCardsSource, /summarizeUsagePricing\(data, modelPrices\)/);
  assert.match(kpiCardsSource, /t\('monitor\.kpi\.cost'\)/);
  assert.match(kpiCardsSource, /formatUsd\(pricingSummary\.totalCost\)/);
  assert.match(kpiCardsSource, /pricingSummary\.pricedRequestCount > 0/);
});

test('监控中心中英文文案包含平均速率与消费金额标签', () => {
  assert.equal(zhLocale.monitor.kpi.avg_rate, '平均速率');
  assert.equal(zhLocale.monitor.kpi.cost, '消费金额');
  assert.equal(enLocale.monitor.kpi.avg_rate, 'Avg Rate');
  assert.equal(enLocale.monitor.kpi.cost, 'Spend');
});
