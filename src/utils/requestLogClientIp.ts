const IPV4_MAPPED_IPV6_REGEX = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

const isValidIpv4 = (value: string): boolean => {
  const segments = value.split('.');
  if (segments.length !== 4) {
    return false;
  }

  return segments.every((segment) => {
    if (!/^\d{1,3}$/.test(segment)) {
      return false;
    }
    const num = Number(segment);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
};

/**
 * 监控中心请求日志里的 client_ip 可能是 IPv4-mapped IPv6（如 ::ffff:1.2.3.4）。
 * 为了让用户按来源 IP 快速识别请求，这里统一折叠为标准 IPv4 展示形式；
 * 真正的 IPv6 地址则保持原样，避免误改写。
 */
export const normalizeRequestClientIp = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const mappedMatch = IPV4_MAPPED_IPV6_REGEX.exec(trimmed);
  if (!mappedMatch) {
    return trimmed;
  }

  return isValidIpv4(mappedMatch[1]) ? mappedMatch[1] : trimmed;
};
