import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

function toDateOnly(dateStr) {
  return new Date(dateStr + 'T00:00:00Z');
}
function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // 단일 날짜 조회 (입력 폼 초기값용)
  if (date) {
    const d = toDateOnly(date);
    const [shiftCounts, overtime] = await Promise.all([
      prisma.overheadShiftCount.findMany({ where: { date: d } }),
      prisma.overheadEntry.findUnique({ where: { date: d } })
    ]);
    return NextResponse.json({
      shiftCounts: shiftCounts.map((sc) => ({ shiftTypeId: sc.shiftTypeId, headcount: sc.headcount })),
      overtimeHours: overtime ? overtime.hours : 0
    });
  }

  // 기간 조회 (입력 내역 요약 테이블용)
  if (start && end) {
    const gte = toDateOnly(start);
    const lte = toDateOnly(end);
    const [shiftCounts, overtimeEntries] = await Promise.all([
      prisma.overheadShiftCount.findMany({ where: { date: { gte, lte } }, include: { shiftType: true } }),
      prisma.overheadEntry.findMany({ where: { date: { gte, lte } } })
    ]);

    const byKey = new Map();
    for (const sc of shiftCounts) {
      const key = dateKey(sc.date);
      const cur = byKey.get(key) || { date: key, totalHeadcount: 0, totalHours: 0, overtimeHours: 0 };
      cur.totalHeadcount += sc.headcount;
      cur.totalHours += sc.headcount * sc.shiftType.hours;
      byKey.set(key, cur);
    }
    for (const ot of overtimeEntries) {
      const key = dateKey(ot.date);
      const cur = byKey.get(key) || { date: key, totalHeadcount: 0, totalHours: 0, overtimeHours: 0 };
      cur.overtimeHours += ot.hours;
      cur.totalHours += ot.hours;
      byKey.set(key, cur);
    }
    const list = Array.from(byKey.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: 'date 또는 start+end 파라미터가 필요합니다.' }, { status: 400 });
}

export async function POST(req) {
  const body = await req.json();
  const { date, counts, overtimeHours } = body;
  if (!date) {
    return NextResponse.json({ error: 'date는 필수입니다.' }, { status: 400 });
  }
  const d = toDateOnly(date);

  await prisma.$transaction(async (tx) => {
    const entries = Object.entries(counts || {});
    for (const [shiftTypeId, headcount] of entries) {
      const hc = Number(headcount) || 0;
      await tx.overheadShiftCount.upsert({
        where: { date_shiftTypeId: { date: d, shiftTypeId } },
        update: { headcount: hc },
        create: { date: d, shiftTypeId, headcount: hc }
      });
    }
    await tx.overheadEntry.upsert({
      where: { date: d },
      update: { hours: Number(overtimeHours) || 0 },
      create: { date: d, hours: Number(overtimeHours) || 0 }
    });
  });

  return NextResponse.json({ ok: true });
}
