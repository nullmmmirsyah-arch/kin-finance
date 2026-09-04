// Shim — deep Period module owns implementation (single source, no duplication)
export {
  type PeriodType,
  type BalanceMode,
  PERIOD_TYPES,
  BALANCE_MODES,
  getWeekBounds,
  getYearBounds,
  getPeriodBounds,
  getPrevPeriod,
  getNextPeriod,
  formatPeriodLabel,
  buildPeriodWindow,
  validatePeriodType,
  validateBalanceMode,
} from "./periodTime";
export { getMonthBounds, zonedMonthStart, getDayBounds, formatMonthLabel, formatDateHeaderTz, formatTimeTz, formatDateShortTz } from "./periodTime";
