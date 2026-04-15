import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [routesSource, layoutSource] = await Promise.all([
  readFile(new URL('../src/router/MainRoutes.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/MainLayout.tsx', import.meta.url), 'utf8'),
]);

test('配置面板路由仍保留，避免影响直达入口', () => {
  assert.match(routesSource, /path:\s*['"]\/config['"],\s*element:\s*<ConfigPage \/>/);
});

test('侧边栏不再显示配置面板导航入口', () => {
  assert.doesNotMatch(layoutSource, /IconSidebarConfig/);
  assert.doesNotMatch(layoutSource, /path:\s*['"]\/config['"],\s*label:\s*t\('nav\.config_management'\)/);
});
