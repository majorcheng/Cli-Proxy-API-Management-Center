import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const authFileSortModuleUrl = `data:text/javascript;base64,${Buffer.from(
  `
  const CODEX_PLAN_ORDER = { pro: 0, plus: 1, team: 2, free: 3 };
  const UNKNOWN_CODEX_PLAN_ORDER = 4;

  export const resolveFirstRegisteredAtMs = (file) => {
    const value = file?.first_registered_at ?? file?.firstRegisteredAt;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 0;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
      }
      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const compareAuthFilesByFirstRegisteredAt = (a, b) => {
    const firstRegisteredAtA = resolveFirstRegisteredAtMs(a);
    const firstRegisteredAtB = resolveFirstRegisteredAtMs(b);
    const hasFirstRegisteredAtA = firstRegisteredAtA > 0;
    const hasFirstRegisteredAtB = firstRegisteredAtB > 0;

    if (hasFirstRegisteredAtA && hasFirstRegisteredAtB) {
      const firstRegisteredDiff = firstRegisteredAtA - firstRegisteredAtB;
      if (firstRegisteredDiff !== 0) return firstRegisteredDiff;
    } else if (hasFirstRegisteredAtA !== hasFirstRegisteredAtB) {
      return hasFirstRegisteredAtA ? -1 : 1;
    }

    return 0;
  };

  const normalizePlanType = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed.toLowerCase() : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  };

  const resolveCodexPlanType = (file) => {
    const candidates = [
      file?.plan_type,
      file?.planType,
      file?.id_token?.plan_type,
      file?.id_token?.planType,
      file?.metadata?.plan_type,
      file?.metadata?.planType,
      file?.metadata?.id_token?.plan_type,
      file?.metadata?.id_token?.planType,
      file?.attributes?.plan_type,
      file?.attributes?.planType,
      file?.attributes?.id_token?.plan_type,
      file?.attributes?.id_token?.planType,
    ];
    for (const candidate of candidates) {
      const normalized = normalizePlanType(candidate);
      if (normalized) return normalized;
    }
    return null;
  };

  const resolveCodexPlanOrder = (file, resolvePlanType) => {
    const overriddenPlanType = resolvePlanType ? normalizePlanType(resolvePlanType(file)) : null;
    const planType = overriddenPlanType ?? resolveCodexPlanType(file);
    if (!planType) return UNKNOWN_CODEX_PLAN_ORDER;
    return CODEX_PLAN_ORDER[planType] ?? UNKNOWN_CODEX_PLAN_ORDER;
  };

  export const compareCodexAuthFilesByPlanAndFirstRegisteredAt = (a, b, resolvePlanType) => {
    const planOrderDiff = resolveCodexPlanOrder(a, resolvePlanType) - resolveCodexPlanOrder(b, resolvePlanType);
    if (planOrderDiff !== 0) return planOrderDiff;

    const firstRegisteredDiff = compareAuthFilesByFirstRegisteredAt(a, b);
    if (firstRegisteredDiff !== 0) return firstRegisteredDiff;

    return a.name.localeCompare(b.name);
  };
  `,
).toString('base64')}`;

const sourcePath = new URL('../src/components/quota/sort.ts', import.meta.url);
const sourceCode = (await readFile(sourcePath, 'utf8')).replace(
  /from ['"]@\/features\/authFiles\/sort['"]/g,
  `from '${authFileSortModuleUrl}'`,
);

const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { compareCodexQuotaFiles } = await import(moduleUrl);

const quotaSectionSource = await readFile(
  new URL('../src/components/quota/QuotaSection.tsx', import.meta.url),
  'utf8',
);
const quotaConfigSource = await readFile(
  new URL('../src/components/quota/quotaConfigs.ts', import.meta.url),
  'utf8',
);

test('Codex 配额卡片按 pro、plus、team、free、unknown 分组排序', () => {
  const files = [
    { name: 'free.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'team.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'pro.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'plus.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'unknown.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
  ];
  const quotaByName = {
    'free.json': { status: 'success', planType: 'free', windows: [] },
    'team.json': { status: 'success', planType: 'team', windows: [] },
    'pro.json': { status: 'success', planType: 'pro', windows: [] },
    'plus.json': { status: 'success', planType: 'plus', windows: [] },
  };

  files.sort((a, b) => compareCodexQuotaFiles(a, b, quotaByName));
  assert.deepEqual(files.map((file) => file.name), [
    'pro.json',
    'plus.json',
    'team.json',
    'free.json',
    'unknown.json',
  ]);
});

test('同套餐组内按 first_registered_at 正序，老账号优先', () => {
  const files = [
    { name: 'team-newer.json', provider: 'codex', first_registered_at: '2026-03-03T00:00:00Z' },
    { name: 'team-older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'team-middle.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
  ];
  const quotaByName = {
    'team-newer.json': { status: 'success', planType: 'team', windows: [] },
    'team-older.json': { status: 'success', planType: 'team', windows: [] },
    'team-middle.json': { status: 'success', planType: 'team', windows: [] },
  };

  files.sort((a, b) => compareCodexQuotaFiles(a, b, quotaByName));
  assert.deepEqual(files.map((file) => file.name), [
    'team-older.json',
    'team-middle.json',
    'team-newer.json',
  ]);
});

test('缺失 first_registered_at 的条目在同套餐组内排到最后', () => {
  const files = [
    { name: 'unknown-time.json', provider: 'codex' },
    { name: 'older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'newer.json', provider: 'codex', firstRegisteredAt: '1772582400' },
  ];
  const quotaByName = {
    'unknown-time.json': { status: 'success', planType: 'free', windows: [] },
    'older.json': { status: 'success', planType: 'free', windows: [] },
    'newer.json': { status: 'success', planType: 'free', windows: [] },
  };

  files.sort((a, b) => compareCodexQuotaFiles(a, b, quotaByName));
  assert.deepEqual(files.map((file) => file.name), [
    'older.json',
    'newer.json',
    'unknown-time.json',
  ]);
});

test('未缓存额度时回退到 auth file 自带的 planType 继续排序', () => {
  const files = [
    { name: 'team.json', provider: 'codex', metadata: { planType: 'team' } },
    { name: 'free.json', provider: 'codex', attributes: { plan_type: 'free' } },
    { name: 'plus.json', provider: 'codex', id_token: { planType: 'plus' } },
  ];

  files.sort((a, b) => compareCodexQuotaFiles(a, b, {}));
  assert.deepEqual(files.map((file) => file.name), ['plus.json', 'team.json', 'free.json']);
});

test('配额区块在分页前应用可选排序钩子，并且仅 Codex 配置接线该钩子', () => {
  assert.match(quotaSectionSource, /const sectionFiles = useMemo\(\(\) => \{/);
  assert.match(quotaSectionSource, /if \(!config\.compareFiles\) return filtered;/);
  assert.match(quotaSectionSource, /return \[\.\.\.filtered\]\.sort\(\(left, right\) => config\.compareFiles!\(left, right, quota\)\);/);
  assert.match(quotaSectionSource, /useQuotaPagination\(sectionFiles\)/);
  assert.match(quotaConfigSource, /compareFiles: compareCodexQuotaFiles,/);
});
