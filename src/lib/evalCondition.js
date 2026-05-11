const ALLOWED = new Set([
  "volatility_annual",
  "max_drawdown",
  "cumulative_return",
  "rows",
  "is_intraday",
  "return_neutral",
]);

export function evalInsightCondition(expr, ctx) {
  const m = expr
    .trim()
    .match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?[\d.]+(?:e[+-]?\d+)?)$/i);
  if (!m) return false;
  const key = m[1];
  const op = m[2];
  const rhs = Number(m[3]);
  if (!ALLOWED.has(key) || Number.isNaN(rhs)) return false;
  const left = ctx[key];
  if (typeof left !== "number" || Number.isNaN(left)) return false;
  switch (op) {
    case ">":
      return left > rhs;
    case "<":
      return left < rhs;
    case ">=":
      return left >= rhs;
    case "<=":
      return left <= rhs;
    case "==":
      return left === rhs;
    case "!=":
      return left !== rhs;
    default:
      return false;
  }
}
