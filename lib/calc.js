// CPC 대시보드 집계 로직
// 두 가지 모드를 지원합니다.
//   headcount : 일자별/워크센터별 "시프트 배치 인원수" 합계로 나눈 CPC
//   hours     : 일자별/워크센터별 "총 근무시간"(시프트 인원수 × 시프트 근무시간의 합 + 연장근무 합계)으로 나눈 CPC
const { prisma } = require('./db');

function toDateStr(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

function daysInRange(startStr, endStr) {
  const out = [];
  let cur = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  while (cur <= end) {
    out.push(toDateStr(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.start  'YYYY-MM-DD'
 * @param {string} opts.end    'YYYY-MM-DD'
 * @param {'headcount'|'hours'} opts.mode
 */
async function getDashboardData({ start, end, mode = 'headcount' }) {
  const rangeStart = new Date(start + 'T00:00:00Z');
  const rangeEnd = new Date(end + 'T00:00:00Z');

  const workcenters = await prisma.workcenter.findMany({ orderBy: { sortOrder: 'asc' } });
  const cpcEntries = await prisma.cpcEntry.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } }
  });
  const shiftCounts = await prisma.shiftCount.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    include: { shiftType: true }
  });
  const overtimeEntries = await prisma.overtimeEntry.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } }
  });
  const overheadShiftCounts = await prisma.overheadShiftCount.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    include: { shiftType: true }
  });
  const overheadEntries = await prisma.overheadEntry.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } }
  });

  // key: 'YYYY-MM-DD|workcenterId' -> { headcount, hours }
  const denomByDateWc = new Map();
  for (const sc of shiftCounts) {
    const key = toDateStr(sc.date) + '|' + sc.workcenterId;
    const cur = denomByDateWc.get(key) || { headcount: 0, hours: 0 };
    cur.headcount += sc.headcount;
    cur.hours += sc.headcount * (sc.shiftType ? sc.shiftType.hours : 0);
    denomByDateWc.set(key, cur);
  }
  for (const ot of overtimeEntries) {
    const key = toDateStr(ot.date) + '|' + ot.workcenterId;
    const cur = denomByDateWc.get(key) || { headcount: 0, hours: 0 };
    cur.hours += ot.hours || 0;
    denomByDateWc.set(key, cur);
  }

  // 날짜별 관리 인력 (워크센터 구분 없음, 시프트코드별 인원수 + 연장근무 합계)
  const overheadByDate = new Map(); // dateStr -> { headcount, hours }
  for (const osc of overheadShiftCounts) {
    const key = toDateStr(osc.date);
    const cur = overheadByDate.get(key) || { headcount: 0, hours: 0 };
    cur.headcount += osc.headcount;
    cur.hours += osc.headcount * (osc.shiftType ? osc.shiftType.hours : 0);
    overheadByDate.set(key, cur);
  }
  for (const oh of overheadEntries) {
    const key = toDateStr(oh.date);
    const cur = overheadByDate.get(key) || { headcount: 0, hours: 0 };
    cur.hours += oh.hours || 0;
    overheadByDate.set(key, cur);
  }

  // 날짜별/워크센터별 raw CPC 합계
  const rawByDateWc = new Map();
  const wcTotals = {};
  for (const wc of workcenters) wcTotals[wc.id] = 0;

  for (const entry of cpcEntries) {
    const dateStr = toDateStr(entry.date);
    const key = dateStr + '|' + entry.workcenterId;
    rawByDateWc.set(key, (rawByDateWc.get(key) || 0) + entry.totalCpc);
    wcTotals[entry.workcenterId] = (wcTotals[entry.workcenterId] || 0) + entry.totalCpc;
  }

  const dates = daysInRange(start, end);
  const daily = dates.map((dateStr) => {
    const row = { date: dateStr, day: Number(dateStr.slice(8, 10)) };
    let totalRaw = 0;
    let totalDenom = 0;
    workcenters.forEach((wc, idx) => {
      const key = dateStr + '|' + wc.id;
      const raw = rawByDateWc.get(key) || 0;
      totalRaw += raw;

      const denomInfo = denomByDateWc.get(key) || { headcount: 0, hours: 0 };
      const denom = mode === 'hours' ? denomInfo.hours : denomInfo.headcount;
      totalDenom += denom;
      const perUnit = denom > 0 ? raw / denom : 0;
      row['p' + (idx + 1)] = perUnit;
      row['p' + (idx + 1) + '_raw'] = raw;
      row['p' + (idx + 1) + '_denom'] = denom;
    });
    const overhead = overheadByDate.get(dateStr) || { headcount: 0, hours: 0 };
    totalDenom += mode === 'hours' ? overhead.hours : overhead.headcount;
    row.total_raw = totalRaw;
    row.total_denom = totalDenom;
    row.total_per_person = totalDenom > 0 ? totalRaw / totalDenom : 0;
    return row;
  });

  const wcTotalsLabeled = {};
  workcenters.forEach((wc) => {
    wcTotalsLabeled[wc.code] = wcTotals[wc.id] || 0;
  });

  // 디스크립션 TOP N (월간 누계)
  const descTotals = new Map();
  const wcById = new Map(workcenters.map((wc) => [wc.id, wc]));
  for (const entry of cpcEntries) {
    const wc = wcById.get(entry.workcenterId);
    const key = (wc ? wc.code : entry.workcenterId) + '||' + entry.description;
    descTotals.set(key, (descTotals.get(key) || 0) + entry.totalCpc);
  }
  const topDesc = Array.from(descTotals.entries())
    .map(([key, total]) => {
      const [workcenter, description] = key.split('||');
      return { workcenter, description, total: Math.round(total * 100) / 100 };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // 표시용 "P#" 번호는 워크센터 코드(예: "P4-Consumable/Dry goods")에 실제로 들어있는
  // 번호를 그대로 사용합니다. 화면에 순서대로 붙이는 번호(1,2,3...)가 아니라
  // 실제 워크센터 코드와 항상 일치시키기 위함입니다. 코드에 P#이 없으면 순서 번호로 대체합니다.
  const seriesMeta = workcenters.map((wc, idx) => {
    const match = /P\s*-?\s*(\d+)/i.exec(wc.code);
    const num = match ? match[1] : String(idx + 1);
    return { name: `P${num} · ${wc.label}`, code: wc.code, color: wc.color };
  });

  return {
    mode,
    range_label: `${start} ~ ${end}`,
    daily,
    wc_totals: wcTotalsLabeled,
    top_desc: topDesc,
    series_meta: seriesMeta
  };
}

module.exports = { getDashboardData, daysInRange, toDateStr };
