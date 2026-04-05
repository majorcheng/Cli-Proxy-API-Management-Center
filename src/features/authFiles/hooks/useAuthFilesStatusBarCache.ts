import { useMemo } from 'react';
import type { AuthFileItem } from '@/types';
import type { UsageDetail } from '@/utils/usage';
import {
  buildAuthFilesStatusBarCache,
  type AuthFileStatusBarData,
} from '@/features/authFiles/statusBarCache';

export type { AuthFileStatusBarData };

export function useAuthFilesStatusBarCache(files: AuthFileItem[], usageDetails: UsageDetail[]) {
  return useMemo(() => buildAuthFilesStatusBarCache(files, usageDetails), [files, usageDetails]);
}
