// CPC 대시보드 집계 로직
// 두 가지 모드를 지원합니다.
//   headcount : 일자별 근무자 "인원 수"로 나눈 CPC (그날 근무시간이 0보다 큰 근무자 수)
//   hours     : 일자별 "총 실근무시간"(기본 스케줄 + 연장근무, 결근 제외)으로 나눈 CPC
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

function weekdayOf(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0=일 ... 6=토
}

// 특정 근무자의 특정 날짜 실근무시간 계산 (기본스케줄 + 연장근무 - 결근)
function workerHoursOnDate(worker, dateStr, dailyHourByWorkerDate) {
  const key = worker.id + '|' + dateStr;
  const dh = dailyHourByWorkerDate.get(key);
  if (dh) {
    if (dh.present === false) return 0;
    const weekday = weekdayOf(dateStr);
    const sched = worker.weeklySchedules.find((w) => w.weekday === weekday);
    const base = dh.scheduledHours != null ? dh.scheduledHours : (sched ? sched.hours : 0);
    return base + (dh.overtimeHours || 0);
  }
  const weekday = weekdayOf(dateStr);
  const sched = worker.weeklySchedules.find((w) => w.weekday === weekday);
  return sched ? sched.hours : 0;
}

/**
 * @param {object} opts
 * @param {string} opts.start  'YYYY-MM-DD'
 * @param {string} opts.end    'YYYY-MM-DD'
 * @param {'headcount'|'hours'} opts.mode
 */
async function getDashboardData({ start, end, mode = 'headcount' }) {
  const workcenters = await prisma.workcenter.findMany({ orderBy: { sortOrder: 'asc' } });
  const workers = await prisma.worker.findMany({
    where: { active: true },
    include: { weeklySchedules: true }
  });
  const cpcEntries = await prisma.cpcEntry.findMany({
    where: { date: { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T00:00:00Z') } }
  });
  const dailyHours = await prisma.dailyHour.findMany({
    where: { date: { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T00:00:00Z') } }
  });

  const dailyHourByWorkerDate = new Map();
  for (const dh of dailyHours) {
    dailyHourByWorkerDate.set(dh.workerId + '|' + toDateStr(dh.date), dh);
  }

  const workersByWc = new Map();
  for (const w of workers) {
    if (!workersByWc.has(w.workcenterId)) workersByWc.set(w.workcenterId, []);
    workersByWc.get(w.workcenterId).push(w);
  }

  // 날짜별/워크센터별 raw CPC 합계
  const rawByDateWc = new Map(); // key: date|wcId -> sum
  const wcTotals = {}; // wcId -> 월 누계
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
    workcenters.forEach((wc, idx) => {
      const raw = rawByDateWc.get(dateStr + '|' + wc.id) || 0;
      totalRaw += raw;

      const wcWorkers = workersByWc.get(wc.id) || [];
      let denom = 0;
      if (mode === 'hours') {
        denom = wcWorkers.reduce((sum, w) => sum + workerHoursOnDate(w, dateStr, dailyHourByWorkerDate), 0);
      } else {
        denom = wcWorkers.reduce((sum, w) => {
          const h = workerHoursOnDate(w, dateStr, dailyHourByWorkerDate);
          return sum + (h > 0 ? 1 : 0);
        }, 0);
      }
      const perUnit = denom > 0 ? raw / denom : 0;
      row['p' + (idx + 1)] = perUnit;
      row['p' + (idx + 1) + '_raw'] = raw;
      row['p' + (idx + 1) + '_denom'] = denom;
    });
    row.total_raw = totalRaw;
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

  const seriesMeta = workcenters.map((wc, idx) => ({ name: `P${idx + 1} · ${wc.label}`, code: wc.code, color: wc.color }));

  return {
    mode,
    range_label: `${start} ~ ${end}`,
    daily,
    wc_totals: wcTotalsLabeled,
    top_desc: topDesc,
    series_meta: seriesMeta
  };
}

module.exports = { getDashboardData, workerHoursOnDate, weekdayOf, daysInRange, toDateStr };
