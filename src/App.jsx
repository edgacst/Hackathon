import { useCallback, useEffect, useMemo, useState } from "react";
import skillsMarkdown from "../Skills.md?raw";
import { parseSkillsMarkdown } from "./lib/parseSkills";
import { parseCsvFile, normalizeRows } from "./lib/csvNormalize";
import { computeMetrics, insightContext } from "./lib/metrics";
import { evalInsightCondition } from "./lib/evalCondition";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatPct(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function formatNum(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return x.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export default function App() {
  const { fieldAliases, insights, summaries } = useMemo(
    () => parseSkillsMarkdown(skillsMarkdown),
    []
  );
  const [fileName, setFileName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [norm, setNorm] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const runPipeline = useCallback(
    async (file) => {
      setLoadError("");
      setFileName(file.name);
      try {
        const raw = await parseCsvFile(file);
        const n = normalizeRows(raw, fieldAliases);
        if (n.errors.length) {
          setNorm(n);
          setMetrics(null);
          const onlyParsedEmpty =
            n.errors.length === 1 &&
            n.errors[0].includes("유효한 날짜·종가 행이 없습니다") &&
            n.mapping?.date &&
            n.mapping?.close;
          if (onlyParsedEmpty && raw?.length) {
            const first = raw[0];
            const dv = first[n.mapping.date];
            const cv = first[n.mapping.close];
            setLoadError(
              `컬럼 매핑은 되었으나, 날짜·종가로 읽을 수 있는 행이 없습니다. 첫 데이터 행의 값을 확인하세요. (날짜="${dv ?? ""}", 종가="${cv ?? ""}")`
            );
          } else {
            setLoadError(n.errors.join(" "));
          }
          return;
        }
        const m = computeMetrics(n.rows);
        setNorm(n);
        setMetrics(m);
      } catch (e) {
        setNorm(null);
        setMetrics(null);
        setLoadError(e?.message || "파일을 읽지 못했습니다.");
      }
    },
    [fieldAliases]
  );

  const loadSample = useCallback(async () => {
    setLoadError("");
    setFileName("sample.csv");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample.csv`);
      if (!res.ok) throw new Error("샘플을 불러오지 못했습니다.");
      const blob = await res.blob();
      const file = new File([blob], "sample.csv", { type: "text/csv" });
      await runPipeline(file);
    } catch (e) {
      setLoadError(e?.message || "샘플 로드 실패");
    }
  }, [runPipeline]);

  const loadKiwoomNqSample = useCallback(async () => {
    setLoadError("");
    setFileName("nq_kiwoom_sample.csv");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}nq_kiwoom_sample.csv`);
      if (!res.ok) throw new Error("키움 형식 샘플을 불러오지 못했습니다.");
      const blob = await res.blob();
      const file = new File([blob], "nq_kiwoom_sample.csv", { type: "text/csv" });
      await runPipeline(file);
    } catch (e) {
      setLoadError(e?.message || "키움 샘플 로드 실패");
    }
  }, [runPipeline]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const ctx = metrics ? insightContext(metrics) : null;
  const firedInsights = useMemo(() => {
    if (!ctx || !insights.length) return [];
    return insights.filter((r) => evalInsightCondition(r.condition, ctx));
  }, [ctx, insights]);

  const firedSummaries = useMemo(() => {
    if (!ctx || !summaries.length) return [];
    return summaries.filter((r) => evalInsightCondition(r.condition, ctx));
  }, [ctx, summaries]);

  const barSlice = useMemo(() => {
    if (!metrics?.series) return [];
    const s = metrics.series.filter((r) => r.dailyReturn !== null);
    return s.slice(-60);
  }, [metrics]);

  const barData = barSlice.map((r) => ({
    date: r.date.slice(5),
    r: r.dailyReturn,
    fill: r.dailyReturn >= 0 ? "var(--positive)" : "var(--negative)",
  }));

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <p className="eyebrow">Skills.md 기반 · 바이브 코딩 데모</p>
            <h1 className="title">투자 데이터 대시보드</h1>
            <p className="subtitle">
              CSV 업로드 시 <code>Skills.md</code>의 필드 별칭·지표·<strong>분석 종합 평</strong>·
              인사이트 규칙을 적용합니다. 영웅문글로벌 <strong>가격데이터 시뮬레이션</strong>(예: NQ000)에서
              <strong>엑셀저장</strong>한 CSV는 <strong>UTF-8·CP949(엑셀 기본)</strong> 모두
              자동 판별합니다. 권장: 다른 이름으로 저장 → <strong>CSV UTF-8</strong>.
            </p>
          </div>
          <div className="header-actions">
            <label className="btn btn-primary">
              CSV 업로드
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) runPipeline(f);
                }}
              />
            </label>
            <button type="button" className="btn btn-ghost" onClick={loadSample}>
              샘플 불러오기
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadKiwoomNqSample}
            >
              키움 NQ 형식 샘플
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {(fileName || loadError) && (
          <p className="meta">
            {fileName && <span>파일: {fileName}</span>}
            {loadError && <span className="error">{loadError}</span>}
          </p>
        )}

        {norm?.mapping && (
          <section className="card mapping-card">
            <h2 className="card-title">컬럼 매핑 (Skills 별칭)</h2>
            <ul className="mapping-list">
              <li>
                <span className="k">date</span>
                <span className="v">{norm.mapping.date ?? "—"}</span>
              </li>
              <li>
                <span className="k">close</span>
                <span className="v">{norm.mapping.close ?? "—"}</span>
              </li>
              <li>
                <span className="k">volume</span>
                <span className="v">{norm.mapping.volume ?? "(없음)"}</span>
              </li>
            </ul>
          </section>
        )}

        {metrics && (
          <>
            <section className="kpi-grid">
              <div className="kpi">
                <span className="kpi-label">누적 수익률</span>
                <span
                  className={`kpi-value ${
                    metrics.cumulativeReturn >= 0 ? "pos" : "neg"
                  }`}
                >
                  {formatPct(metrics.cumulativeReturn)}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">연율화 변동성 (추정)</span>
                <span className="kpi-value">{formatPct(metrics.volatilityAnnual)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">최대 낙폭 (MDD)</span>
                <span className="kpi-value neg">{formatPct(metrics.maxDrawdown)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">최근 종가</span>
                <span className="kpi-value mono">
                  {formatNum(metrics.series.at(-1)?.close)}
                </span>
              </div>
            </section>

            <section className="card summary-card">
              <h2 className="card-title">분석 종합 평 (Skills §7)</h2>
              {firedSummaries.length === 0 ? (
                <p className="muted">현재 지표 조합에 해당하는 평 규칙이 없습니다.</p>
              ) : (
                <ul className="summary-list">
                  {firedSummaries.map((r, i) => (
                    <li key={i} className="summary-item">
                      <p className="summary-text">{r.text}</p>
                      <span className="summary-cond mono">{r.condition}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card chart-card">
              <h2 className="card-title">가격 추이</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.series}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => String(v).slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "var(--text)" }}
                      formatter={(v) => [formatNum(v), "종가"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {metrics.series.some((r) => r.volume != null) && (
              <section className="card chart-card">
                <h2 className="card-title">거래량</h2>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.series}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--muted)", fontSize: 10 }}
                        tickFormatter={(v) => String(v).slice(5)}
                        minTickGap={16}
                      />
                      <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                        formatter={(v) => [formatNum(v), "거래량"]}
                      />
                      <Bar dataKey="volume" fill="var(--surface2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section className="card chart-card">
              <h2 className="card-title">누적 수익률</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={metrics.series}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => String(v).slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                      formatter={(v) => [formatPct(v), "누적"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumReturn"
                      stroke="var(--accent)"
                      fill="url(#cumGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card chart-card">
              <h2 className="card-title">최근 일간 수익률 (최대 60영업일)</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                    <YAxis
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                      formatter={(v) => [formatPct(v), "일간"]}
                    />
                    <Bar dataKey="r" radius={[3, 3, 0, 0]}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill={barData[i].fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card insights-card">
              <h2 className="card-title">인사이트 (Skills §6)</h2>
              {firedInsights.length === 0 ? (
                <p className="muted">현재 데이터에 대해 발화된 규칙이 없습니다.</p>
              ) : (
                <ul className="insight-list">
                  {firedInsights.map((r, i) => (
                    <li key={i} className="insight-item">
                      <span className="insight-msg">{r.message}</span>
                      <span className="insight-cond mono">{r.condition}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          본 데모는 교육·시연용입니다. 투자 권유가 아닙니다. 규칙은 루트{" "}
          <code>Skills.md</code>를 수정한 뒤 빌드하면 반영됩니다.
        </p>
      </footer>

      <style>{`
        .app { min-height: 100vh; display: flex; flex-direction: column; }
        .header {
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
        }
        .header-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 1.25rem 1.75rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          align-items: flex-start;
          justify-content: space-between;
        }
        .eyebrow {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent);
          margin: 0 0 0.35rem;
          font-weight: 600;
        }
        .title { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
        .subtitle { margin: 0; color: var(--muted); max-width: 36rem; line-height: 1.55; font-size: 0.95rem; }
        .subtitle code {
          font-family: var(--mono);
          font-size: 0.85em;
          background: var(--surface2);
          padding: 0.1em 0.35em;
          border-radius: 4px;
        }
        .header-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.6rem 1rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          transition: background 0.15s, color 0.15s;
        }
        .btn-primary {
          background: var(--accent);
          color: #fff;
        }
        .btn-primary:hover { background: var(--accent-dim); }
        .btn-ghost {
          background: var(--surface2);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .btn-ghost:hover { background: var(--border); }
        .main {
          flex: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem 3rem;
          width: 100%;
        }
        .meta { font-size: 0.85rem; color: var(--muted); margin: 0 0 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
        .meta .error { color: var(--negative); }
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.25rem 1.35rem;
          margin-bottom: 1rem;
        }
        .card-title { font-size: 1rem; font-weight: 600; margin: 0 0 1rem; }
        .mapping-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
        .mapping-list li { display: flex; gap: 0.75rem; align-items: baseline; font-size: 0.9rem; }
        .mapping-list .k { font-family: var(--mono); color: var(--accent); min-width: 4rem; }
        .mapping-list .v { color: var(--text); }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .kpi {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem 1.15rem;
        }
        .kpi-label { display: block; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; }
        .kpi-value { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; }
        .kpi-value.pos { color: var(--positive); }
        .kpi-value.neg { color: var(--negative); }
        .mono { font-family: var(--mono); font-size: 1.1rem; }
        .chart-wrap { width: 100%; margin: 0 -0.25rem; }
        .muted { color: var(--muted); margin: 0; font-size: 0.9rem; }
        .insight-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
        .insight-item {
          padding: 0.85rem 1rem;
          background: var(--surface2);
          border-radius: 8px;
          border-left: 3px solid var(--warning);
        }
        .insight-msg { display: block; font-size: 0.95rem; margin-bottom: 0.35rem; line-height: 1.45; }
        .insight-cond { font-size: 0.75rem; color: var(--muted); }
        .summary-card { border-color: #3d5a80; }
        .summary-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }
        .summary-item {
          padding: 0.85rem 1rem;
          background: var(--surface2);
          border-radius: 8px;
          border-left: 3px solid var(--accent);
        }
        .summary-text { margin: 0 0 0.4rem; font-size: 0.95rem; line-height: 1.55; color: var(--text); }
        .summary-cond { font-size: 0.72rem; color: var(--muted); }
        .footer {
          border-top: 1px solid var(--border);
          padding: 1rem 1.25rem 1.5rem;
          margin-top: auto;
        }
        .footer p {
          max-width: 1100px;
          margin: 0 auto;
          font-size: 0.8rem;
          color: var(--muted);
          line-height: 1.5;
        }
        .footer code { font-family: var(--mono); font-size: 0.85em; }
      `}</style>
    </div>
  );
}
