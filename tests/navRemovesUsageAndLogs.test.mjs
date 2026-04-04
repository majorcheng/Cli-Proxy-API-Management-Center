import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [routesSource, layoutSource] = await Promise.all([
  readFile(new URL('../src/router/MainRoutes.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/MainLayout.tsx', import.meta.url), 'utf8'),
]);

test('主路由不再注册 usage 与 logs 页面', () => {
  assert.doesNotMatch(routesSource, /import \{ UsagePage \} from ['"]@\/pages\/UsagePage['"]/);
  assert.doesNotMatch(routesSource, /import \{ LogsPage \} from ['"]@\/pages\/LogsPage['"]/);
  assert.doesNotMatch(routesSource, /path:\s*['"]\/usage['"]/);
  assert.doesNotMatch(routesSource, /path:\s*['"]\/logs['"]/);
});

test('侧边栏不再显示 usage 与 logs 导航入口', () => {
  assert.doesNotMatch(layoutSource, /IconSidebarUsage/);
  assert.doesNotMatch(layoutSource, /IconSidebarLogs/);
  assert.doesNotMatch(layoutSource, /path:\s*['"]\/usage['"],\s*label:\s*t\('nav\.usage_stats'\)/);
  assert.doesNotMatch(layoutSource, /path:\s*['"]\/logs['"],\s*label:\s*t\('nav\.logs'\)/);
});
