import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const systemPageSource = await readFile(new URL('../src/pages/SystemPage.tsx', import.meta.url), 'utf8');
const linkResolverSource = await readFile(
  new URL('../src/utils/systemPageLinks.ts', import.meta.url),
  'utf8',
);

test('中心信息页的 WebUI 仓库链接会通过独立 helper 读取配置', () => {
  assert.match(systemPageSource, /const webuiRepoUrl = resolveSystemPageWebuiRepoUrl\(config\);/);
  assert.match(systemPageSource, /href=\{webuiRepoUrl\}/);
});

test('WebUI 仓库链接优先读取 remote-management 配置，缺失时回退到当前维护仓库', () => {
  assert.ok(linkResolverSource.includes("remoteManagement?.['panel-github-repository']"));
  assert.ok(linkResolverSource.includes("remoteManagement?.['panel-repo']"));
  assert.match(
    linkResolverSource,
    /DEFAULT_WEBUI_REPO_URL\s*=\s*'https:\/\/github\.com\/majorcheng\/Cli-Proxy-API-Management-Center'/,
  );
  assert.match(linkResolverSource, /return configuredUrl \|\| DEFAULT_WEBUI_REPO_URL;/);
});
