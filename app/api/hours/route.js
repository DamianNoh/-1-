import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get('workerId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const list = await prisma.dailyHour.findMany({
    where: {
      ...(workerId ? { workerId } : {}),
      ...(start && end ? { date: { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T00:00:00Z') } } : {})
    },
    include: { worker: true },
    orderBy: [{ date: 'asc' }]
  });
  return NextResponse.json(list);
}

// 특정 근무자의 특정 날짜 실근무시간 upsert (연장근무/결근/스케줄 예외 처리)
// body: { workerId, date('YYYY-MM-DD'), scheduledHours, overtimeHours, present, note }
export async function POST(req) {
  const body = await req.json();
  if (!body.workerId || !body.date) {
    return NextResponse.json({ error: 'workerId, date는 필수입니다.' }, { status: 400 });
  }
  const date = new Date(body.date + 'T00:00:00Z');
  const item = await prisma.dailyHour.upsert({
    where: { workerId_date: { workerId: body.workerId, date } },
    update: {
      scheduledHours: body.scheduledHours === '' || body.scheduledHours === null ? null : Number(body.scheduledHours),
      overtimeHours: Number(body.overtimeHours || 0),
      present: body.present !== undefined ? Boolean(body.present) : true,
      note: body.note || null
    },
    create: {
      workerId: body.workerId,
      date,
      scheduledHours: body.scheduledHours === '' || body.scheduledHours === null || body.scheduledHours === undefined ? null : Number(body.scheduledHours),
      overtimeHours: Number(body.overtimeHours || 0),
      present: body.present !== undefined ? Boolean(body.present) : true,
      note: body.note || null
    }
  });
  return NextResponse.json(item, { status: 201 });
}
