export const resolveServiceHealthTooltipIndex = (
  activeTooltip: number | null,
  blockCount: number
): number | null => {
  if (activeTooltip === null) {
    return null;
  }

  if (!Number.isInteger(activeTooltip)) {
    return null;
  }

  if (activeTooltip < 0 || activeTooltip >= blockCount) {
    return null;
  }

  return activeTooltip;
};
