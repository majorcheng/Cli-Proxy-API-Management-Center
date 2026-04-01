import { access, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as fsConstants } from 'node:fs';

/**
 * 构建后默认补一份 management.html，方便本地直接联调后端管理页入口。
 * 保留原始 index.html，避免影响现有静态预览和其他工具链。
 */
export const prepareManagementHtml = async ({
  distDir,
  sourceName = 'index.html',
  targetName = 'management.html',
} = {}) => {
  const resolvedDistDir =
    distDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const sourcePath = path.join(resolvedDistDir, sourceName);
  const targetPath = path.join(resolvedDistDir, targetName);

  await access(sourcePath, fsConstants.R_OK);
  await copyFile(sourcePath, targetPath);

  return {
    distDir: resolvedDistDir,
    sourcePath,
    targetPath,
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const distArg = process.argv[2];

  prepareManagementHtml({ distDir: distArg ? path.resolve(distArg) : undefined })
    .then(({ targetPath }) => {
      console.log(`已生成 ${targetPath}`);
    })
    .catch((error) => {
      console.error('生成 management.html 失败：', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
