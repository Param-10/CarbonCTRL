/** tCO₂e with precision that suits the size: 123, 12.3, 0.123 */
export const formatTonnes = (value: number) => {
  if (value >= 100) return value.toFixed(0);
  if (value >= 1) return value.toFixed(1);
  return value.toFixed(3);
};
