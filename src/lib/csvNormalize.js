import Papa from "papaparse";

/** UTF-8 BOM 제거 (엑셀 CSV 첫 헤더에 자주 붙음) */
function stripBom(s) {
  return String(s ?? "").replace(/^\uFEFF/, "");
}

/** 헤더·별칭 비교용: 앞뒤 공백 제거, 연속 공백 하나로 통일, 전각 공백 → 반각 */
function normKey(s) {
  return stripBom(String(s ?? ""))
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normKeyLoose(s) {
  return normKey(s).replace(/\s/g, "");
}

function findColumn(headers, aliases) {
  const cleaned = headers.map((h) => stripBom(h));
  const hNorm = cleaned.map(normKey);
  const hLoose = cleaned.map(normKeyLoose);
  for (const a of aliases) {
    const an = normKey(a);
    const al = normKeyLoose(a);
    let i = hNorm.indexOf(an);
    if (i === -1) i = hLoose.indexOf(al);
    if (i !== -1) return headers[i];
  }
  return null;
}

/**
 * 영웅문글로벌 가격데이터 시뮬레이션 8열 형식 위치 폴백
 * 0:일시, 1:시가, 2:고가, 3:저가, 4:종가, 5:거래량, …
 */
function inferKiwoomPriceGridMapping(headers, rawRows) {
  if (headers.length < 5 || rawRows.length < 1) return null;
  const sampleN = Math.min(30, rawRows.length);
  let dateHits = 0;
  let closeHits = 0;
  for (let i = 0; i < sampleN; i++) {
    const row = rawRows[i];
    if (parseDate(row[headers[0]])) dateHits++;
    const c = parseNum(row[headers[4]]);
    if (c !== null && c > 0) closeHits++;
  }
  if (dateHits < sampleN * 0.5 || closeHits < sampleN * 0.5) return null;
  return {
    date: headers[0],
    close: headers[4],
    volume: headers.length > 5 ? headers[5] : null,
  };
}

function formatRowLabel(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const mi = d.getMinutes();
  const se = d.getSeconds();
  if (h === 0 && mi === 0 && se === 0) return `${y}-${mo}-${da}`;
  return `${y}-${mo}-${da} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function parseDate(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  // "2026/04/09-04:54:00" (키움 분봉 등)
  const withTime = s.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[-T ](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (withTime) {
    const d = new Date(
      Number(withTime[1]),
      Number(withTime[2]) - 1,
      Number(withTime[3]),
      Number(withTime[4]),
      Number(withTime[5]),
      withTime[6] != null ? Number(withTime[6]) : 0
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const d = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseNum(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const t = String(raw).trim();
  if (/^-?\d+,\d+$/.test(t)) {
    const n = Number(t.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function csvFirstLine(text) {
  return (text.split(/\r?\n/, 1)[0] || "").slice(0, 1200);
}

/** UTF-8 vs CP949(EUC-KR) 자동 선택 — 엑셀 ‘CSV(쉼표로 분리)’ 한국 기본 인코딩 대응 */
function scoreHeaderLine(line) {
  if (!line) return -1000;
  let score = 0;
  if (line.includes("종가")) score += 60;
  if (line.includes("일자")) score += 50;
  if (line.includes("거래량")) score += 40;
  if (line.includes("시가")) score += 25;
  if (line.includes("고가")) score += 15;
  if (line.includes("저가")) score += 15;
  if (line.includes("미결제")) score += 15;
  score -= (line.match(/\uFFFD/g) || []).length * 15;
  return score;
}

function decodeCsvBytes(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const utf8Line = csvFirstLine(utf8);
  const sUtf = scoreHeaderLine(utf8Line);

  let euc = "";
  try {
    euc = new TextDecoder("euc-kr").decode(bytes);
  } catch {
    try {
      euc = new TextDecoder("windows-949").decode(bytes);
    } catch {
      return utf8;
    }
  }
  const eucLine = csvFirstLine(euc);
  const sEuc = scoreHeaderLine(eucLine);

  if (sEuc > sUtf) return euc;
  return utf8;
}

export async function parseCsvFile(file) {
  const buf = await file.arrayBuffer();
  const text = decodeCsvBytes(new Uint8Array(buf));
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) =>
        stripBom(String(h ?? ""))
          .trim()
          .replace(/\u3000/g, " "),
      complete: (res) => {
        if (res.errors?.length) {
          const fatal = res.errors.find((e) => e.type === "Quotes" || e.row);
          if (fatal && !res.data?.length) reject(new Error(fatal.message));
        }
        const data = Array.isArray(res.data) ? res.data : [];
        resolve(data);
      },
      error: (e) => reject(e),
    });
  });
}

export function normalizeRows(rawRows, fieldAliases) {
  if (!rawRows?.length) {
    return { rows: [], errors: ["데이터가 비어 있습니다."], mapping: {} };
  }
  const headers = Object.keys(rawRows[0]);
  let mapping = {
    date: findColumn(headers, fieldAliases.date),
    close: findColumn(headers, fieldAliases.close),
    volume: findColumn(headers, fieldAliases.volume),
  };

  const inferred = inferKiwoomPriceGridMapping(headers, rawRows);
  if (inferred) {
    if (!mapping.date) mapping = { ...mapping, date: inferred.date };
    if (!mapping.close) mapping = { ...mapping, close: inferred.close };
    if (!mapping.volume && inferred.volume)
      mapping = { ...mapping, volume: inferred.volume };
  }

  const errors = [];
  if (!mapping.date) errors.push("날짜 컬럼을 Skills 별칭에 맞게 찾지 못했습니다.");
  if (!mapping.close) errors.push("종가 컬럼을 Skills 별칭에 맞게 찾지 못했습니다.");
  if (errors.length) return { rows: [], errors, mapping };

  const byTime = new Map();
  for (const r of rawRows) {
    const d = parseDate(r[mapping.date]);
    const c = parseNum(r[mapping.close]);
    if (!d || c === null) continue;
    const vol =
      mapping.volume != null ? parseNum(r[mapping.volume]) : null;
    const key = d.getTime();
    byTime.set(key, {
      date: formatRowLabel(d),
      dateObj: d,
      close: c,
      volume: vol !== null && Number.isFinite(vol) ? vol : null,
    });
  }

  const rows = Array.from(byTime.values()).sort(
    (a, b) => a.dateObj - b.dateObj
  );
  if (!rows.length) errors.push("유효한 날짜·종가 행이 없습니다.");
  return { rows, errors, mapping };
}
