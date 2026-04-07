import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const constantsModuleUrl = `data:text/javascript;base64,${Buffer.from(
  `
  const INTEGER_STRING_PATTERN = /^[-+]?\d+$/;

  export const normalizeProviderKey = (value) => String(value ?? '').trim().toLowerCase();

  export const parsePriorityValue = (value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : undefined;
    }

    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || !INTEGER_STRING_PATTERN.test(trimmed)) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  };
  `,
).toString('base64')}`;

const quotaUtilsModuleUrl = `data:text/javascript;base64,${Buffer.from(
  `
  export const normalizePlanType = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed.toLowerCase() : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  };

  export const resolveCodexPlanType = (file) => {
    const candidates = [
      file?.plan_type,
      file?.planType,
      file?.id_token,
      file?.id_token?.plan_type,
      file?.id_token?.planType,
      file?.metadata?.plan_type,
      file?.metadata?.planType,
      file?.metadata?.id_token,
      file?.metadata?.id_token?.plan_type,
      file?.metadata?.id_token?.planType,
      file?.attributes?.plan_type,
      file?.attributes?.planType,
      file?.attributes?.id_token,
      file?.attributes?.id_token?.plan_type,
      file?.attributes?.id_token?.planType,
    ];

    const parseValue = (candidate) => {
      if (!candidate) return null;
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (!trimmed) return null;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return normalizePlanType(parsed.plan_type ?? parsed.planType);
          }
        } catch {}
        return normalizePlanType(candidate);
      }
      if (typeof candidate === 'object') {
        return normalizePlanType(candidate.plan_type ?? candidate.planType);
      }
      return normalizePlanType(candidate);
    };

    for (const candidate of candidates) {
      const normalized = parseValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  };
  `,
).toString('base64')}`;

const sourcePath = new URL('../src/features/authFiles/sort.ts', import.meta.url);
const sourceCode = (await readFile(sourcePath, 'utf8'))
  .replace(/from ['"]@\/features\/authFiles\/constants['"]/g, `from '${constantsModuleUrl}'`)
  .replace(/from ['"]@\/utils\/quota['"]/g, `from '${quotaUtilsModuleUrl}'`);
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const {
  compareAuthFilesByDefaultSort,
  compareCodexAuthFilesByPlanAndFirstRegisteredAt,
  resolveFirstRegisteredAtMs,
} = await import(moduleUrl);

test('Codex 认证文件默认排序优先按套餐分组，priority 只在同套餐组内生效', () => {
  const files = [
    { name: 'free.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z', planType: 'free', priority: 99 },
    { name: 'team.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z', planType: 'team', priority: 50 },
    { name: 'pro.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z', planType: 'pro', priority: 1 },
    { name: 'plus.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z', planType: 'plus', priority: 0 },
    { name: 'unknown.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['pro.json', 'plus.json', 'team.json', 'free.json', 'unknown.json'],
  );
});

test('认证文件默认排序优先按 first_registered_at 正序，老账号在前', () => {
  const files = [
    { name: 'older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'newer.json', provider: 'codex', first_registered_at: '2026-03-03T00:00:00Z' },
    { name: 'middle.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['older.json', 'middle.json', 'newer.json'],
  );
});

test('认证文件默认排序在同套餐组内先按 priority 倒序，再回退到首注时间', () => {
  const files = [
    {
      name: 'team-older-low.json',
      provider: 'codex',
      planType: 'team',
      priority: 1,
      first_registered_at: '2026-03-01T00:00:00Z',
    },
    {
      name: 'team-newer-high.json',
      provider: 'codex',
      planType: 'team',
      priority: 9,
      first_registered_at: '2026-03-03T00:00:00Z',
    },
    {
      name: 'team-older-high.json',
      provider: 'codex',
      planType: 'team',
      priority: 9,
      first_registered_at: '2026-03-02T00:00:00Z',
    },
    {
      name: 'team-default-priority.json',
      provider: 'codex',
      planType: 'team',
      first_registered_at: '2026-03-04T00:00:00Z',
    },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['team-older-high.json', 'team-newer-high.json', 'team-older-low.json', 'team-default-priority.json'],
  );
});

test('默认排序兼容秒级时间戳和 camelCase firstRegisteredAt', () => {
  const files = [
    { name: 'iso.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
    { name: 'seconds.json', provider: 'codex', first_registered_at: 1772496000 },
    { name: 'camel.json', provider: 'codex', firstRegisteredAt: '1772582400' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['iso.json', 'seconds.json', 'camel.json'],
  );
  assert.equal(resolveFirstRegisteredAtMs(files[2]), 1772582400000);
});

test('Codex 默认排序可从 metadata、attributes 和 id_token 读取套餐类型', () => {
  const files = [
    { name: 'team.json', provider: 'codex', metadata: { planType: 'team' } },
    { name: 'free.json', provider: 'codex', attributes: { plan_type: 'free' } },
    { name: 'plus.json', provider: 'codex', id_token: { planType: 'plus' } },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['plus.json', 'team.json', 'free.json'],
  );
});

test('缺少首注时间时回退到 provider 和 name，保证排序稳定', () => {
  const files = [
    { name: 'b.json', provider: 'gemini' },
    { name: 'a.json', provider: 'codex' },
    { name: 'c.json', provider: 'codex' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['a.json', 'c.json', 'b.json'],
  );
});

test('缺少首注时间的条目不会被误判成最老账号排到最前面', () => {
  const files = [
    { name: 'unknown.json', provider: 'codex' },
    { name: 'older.json', provider: 'codex', first_registered_at: '2026-03-01T00:00:00Z' },
    { name: 'newer.json', provider: 'codex', first_registered_at: '2026-03-02T00:00:00Z' },
  ];

  files.sort(compareAuthFilesByDefaultSort);
  assert.deepEqual(
    files.map((file) => file.name),
    ['older.json', 'newer.json', 'unknown.json'],
  );
});

test('共享的 Codex 排序 helper 在同套餐组内按 priority、首注时间和名称稳定排序', () => {
  const files = [
    { name: 'b.json', provider: 'codex', planType: 'team', priority: 3 },
    { name: 'a.json', provider: 'codex', planType: 'team', priority: 3 },
    {
      name: 'older-high.json',
      provider: 'codex',
      planType: 'team',
      priority: 9,
      first_registered_at: '2026-03-01T00:00:00Z',
    },
  ];

  files.sort(compareCodexAuthFilesByPlanAndFirstRegisteredAt);
  assert.deepEqual(
    files.map((file) => file.name),
    ['older-high.json', 'a.json', 'b.json'],
  );
});
