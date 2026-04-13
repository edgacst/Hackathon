/**
 * Skills.md 텍스트에서 필드 별칭·인사이트 규칙을 추출합니다.
 */

function parseFieldBlocks(md) {
  const fields = {};
  const parts = md.split(/^###\s+/m);
  for (const part of parts) {
    const lineMatch = part.match(/^(\w+)\s*(?:\([^)]*\))?\s*\n/);
    if (!lineMatch) continue;
    const key = lineMatch[1].toLowerCase();
    if (!["date", "close", "volume"].includes(key)) continue;
    const aliasLine = part.match(/별칭:\s*(.+)/);
    if (!aliasLine) continue;
    const inside = aliasLine[1];
    const aliases = [];
    const tick = /`([^`]+)`/g;
    let m;
    while ((m = tick.exec(inside)) !== null) {
      aliases.push(m[1].trim().toLowerCase());
    }
    if (aliases.length) fields[key] = aliases;
  }
  return fields;
}

function parseInsightRules(md) {
  const section = md.split("## 6. 인사이트 생성 규칙")[1];
  if (!section) return [];
  const body = section.split(/^## \d+\./m)[0];
  const lines = body.split("\n");
  const rules = [];
  const lineRe =
    /^-\s*조건:\s*`([^`]+)`\s*\|\s*메시지:\s*(.+?)\s*$/;
  for (const line of lines) {
    const m = line.match(lineRe);
    if (m) rules.push({ condition: m[1].trim(), message: m[2].trim() });
  }
  return rules;
}

function parseSummaryRules(md) {
  const section = md.split("## 7. 분석 종합 평")[1];
  if (!section) return [];
  const body = section.split(/^## \d+\./m)[0];
  const lines = body.split("\n");
  const rules = [];
  const lineRe = /^-\s*조건:\s*`([^`]+)`\s*\|\s*평:\s*(.+?)\s*$/;
  for (const line of lines) {
    const m = line.match(lineRe);
    if (m) rules.push({ condition: m[1].trim(), text: m[2].trim() });
  }
  return rules;
}

const DEFAULT_FIELDS = {
  date: [
    "date",
    "날짜",
    "일자",
    "일자 / 시간",
    "일자/시간",
    "일자/ 시간",
    "time",
    "timestamp",
  ],
  close: ["close", "종가", "adj_close", "price", "종가(원)"],
  volume: ["volume", "거래량", "vol"],
};

export function parseSkillsMarkdown(md) {
  const parsed = parseFieldBlocks(md);
  const fieldAliases = {
    date: parsed.date?.length ? parsed.date : DEFAULT_FIELDS.date,
    close: parsed.close?.length ? parsed.close : DEFAULT_FIELDS.close,
    volume: parsed.volume?.length ? parsed.volume : DEFAULT_FIELDS.volume,
  };
  const insights = parseInsightRules(md);
  const summaries = parseSummaryRules(md);
  return { fieldAliases, insights, summaries };
}
