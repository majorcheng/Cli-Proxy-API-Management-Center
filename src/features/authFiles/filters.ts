export interface AuthFileFilterItem {
  name: string;
  type?: string | null;
  provider?: string | null;
  disabled?: boolean | null;
  has_refresh_token?: boolean | null;
  refresh_token?: string | null;
  status_message?: unknown;
  statusMessage?: unknown;
}

export type AuthFilesScopeFilterOptions = {
  typeFilter: string;
  problemOnly?: boolean;
  disabledOnly?: boolean;
};

export type AuthFilesVisibilityFilterOptions = AuthFilesScopeFilterOptions & {
  searchTerm?: string;
};

const hasStatusMessage = (file: AuthFileFilterItem): boolean => {
  const raw = file.status_message ?? file.statusMessage;
  if (typeof raw === 'string') {
    return raw.trim().length > 0;
  }
  if (raw == null) {
    return false;
  }
  return String(raw).trim().length > 0;
};

const hasRefreshToken = (file: AuthFileFilterItem): boolean => {
  if (typeof file.has_refresh_token === 'boolean') {
    return file.has_refresh_token;
  }
  if (typeof file.refresh_token === 'string') {
    return file.refresh_token.trim().length > 0;
  }
  return false;
};

/**
 * 仅应用类型 / 问题 / 无法刷新三类范围过滤，便于列表和批量操作共用同一口径。
 */
export const applyAuthFilesScopeFilters = <T extends AuthFileFilterItem>(
  files: T[],
  options: AuthFilesScopeFilterOptions
): T[] => {
  const { typeFilter, problemOnly = false, disabledOnly = false } = options;

  return files.filter((file) => {
    if (typeFilter !== 'all' && file.type !== typeFilter) {
      return false;
    }
    if (problemOnly && !hasStatusMessage(file)) {
      return false;
    }
    if (disabledOnly && hasRefreshToken(file)) {
      return false;
    }
    return true;
  });
};

/**
 * 列表展示过滤：在范围过滤基础上继续应用搜索关键字。
 */
export const applyAuthFilesVisibilityFilters = <T extends AuthFileFilterItem>(
  files: T[],
  options: AuthFilesVisibilityFilterOptions
): T[] => {
  const scoped = applyAuthFilesScopeFilters(files, options);
  const term = options.searchTerm?.trim().toLowerCase() ?? '';

  if (!term) {
    return scoped;
  }

  return scoped.filter((file) => {
    return (
      file.name.toLowerCase().includes(term) ||
      String(file.type ?? '')
        .toLowerCase()
        .includes(term) ||
      String(file.provider ?? '')
        .toLowerCase()
        .includes(term)
    );
  });
};
