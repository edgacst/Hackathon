function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdevSample(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v =
    arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function detectIntradayLikely(rows) {
  return (
    rows.length > 0 &&
    rows.some((r) => /\d{1,2}:\d{2}/.test(String(r.date ?? "")))
  );
}

export function computeMetrics(rows) {
  const n = rows.length;
  const intradayLikely = detectIntradayLikely(rows);
  if (n < 2) {
    return {
      rows: n,
      intradayLikely,
      dailyReturns: [],
      cumulativeReturn: 0,
      volatilityAnnual: 0,
      maxDrawdown: 0,
      series: rows.map((r) => ({
        date: r.date,
        close: r.close,
        cumReturn: 0,
        dailyReturn: null,
        volume: r.volume,
      })),
    };
  }

  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    const prev = rows[i - 1].close;
    const cur = rows[i].close;
    dailyReturns.push(prev !== 0 ? (cur - prev) / prev : 0);
  }

  let prod = 1;
  for (const r of dailyReturns) prod *= 1 + r;
  const cumulativeReturn = prod - 1;

  const volDaily = stdevSample(dailyReturns);
  const volatilityAnnual = volDaily * Math.sqrt(252);

  let peak = rows[0].close;
  let maxDd = 0;
  for (const r of rows) {
    if (r.close > peak) peak = r.close;
    const dd = peak !== 0 ? r.close / peak - 1 : 0;
    if (dd < maxDd) maxDd = dd;
  }

  const series = rows.map((r, i) => {
    let cum = 0;
    if (i > 0) {
      let p = 1;
      for (let j = 0; j < i; j++) {
        const prev = rows[j].close;
        const cur = rows[j + 1].close;
        p *= 1 + (prev !== 0 ? (cur - prev) / prev : 0);
      }
      cum = p - 1;
    }
    const dailyReturn = i === 0 ? null : dailyReturns[i - 1];
    return {
      date: r.date,
      close: r.close,
      cumReturn: cum,
      dailyReturn,
      volume: r.volume,
    };
  });

  return {
    rows: n,
    intradayLikely,
    dailyReturns,
    cumulativeReturn,
    volatilityAnnual,
    maxDrawdown: maxDd,
    series,
  };
}

export function insightContext(metrics) {
  const cr = metrics.cumulativeReturn;
  const return_neutral =
    metrics.rows >= 2 && cr >= -0.15 && cr <= 0.15 ? 1 : 0;
  return {
    rows: metrics.rows,
    volatility_annual: metrics.volatilityAnnual,
    max_drawdown: metrics.maxDrawdown,
    cumulative_return: metrics.cumulativeReturn,
    is_intraday: metrics.intradayLikely ? 1 : 0,
    return_neutral,
  };
}
