import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get('workerId');
  const list = await prisma.weeklySchedule.findMany({
    where: workerId ? { workerId } : {},
    orderBy: [{ workerId: 'asc' }, { weekday: 'asc' }]
  });
  return NextResponse.json(list);
}

// 파트타임 근무자의 요일별 기본 근무시간 upsert
// body: { workerId, weekday(0~6), hours }
export async function POST(req) {
  const body = await req.json();
  if (body.workerId === undefined || body.weekday === undefined || body.hours === undefined) {
    return NextResponse.json({ error: 'workerId, weekday, hours는 필수입니다.' }, { status: 400 });
  }
  const item = await prisma.weeklySchedule.upsert({
    where: { workerId_weekday: { workerId: body.workerId, weekday: Number(body.weekday) } },
    update: { hours: Number(body.hours) },
    create: { workerId: body.workerId, weekday: Number(body.weekday), hours: Number(body.hours) }
  });
  return NextResponse.json(item, { status: 201 });
}
