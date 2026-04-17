import type { Config } from '@/types';

export const DEFAULT_WEBUI_REPO_URL =
  'https://github.com/majorcheng/Cli-Proxy-API-Management-Center';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 从后端配置里解析中心信息页的 WebUI 仓库链接。
 * 优先读取 remote-management 下的配置值，缺失时回退到当前维护仓库地址。
 */
export function resolveSystemPageWebuiRepoUrl(config: Config | null | undefined): string {
  const rawConfig = isRecord(config?.raw) ? config.raw : null;
  const remoteManagement = isRecord(rawConfig?.['remote-management'])
    ? rawConfig['remote-management']
    : null;
  const configuredUrl =
    typeof remoteManagement?.['panel-github-repository'] === 'string'
      ? remoteManagement['panel-github-repository'].trim()
      : typeof remoteManagement?.['panel-repo'] === 'string'
        ? remoteManagement['panel-repo'].trim()
        : '';

  return configuredUrl || DEFAULT_WEBUI_REPO_URL;
}
