import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const workcenterId = searchParams.get('workcenterId');
  const limit = Math.min(Number(searchParams.get('limit') || 200), 1000);

  const list = await prisma.cpcEntry.findMany({
    where: {
      ...(start && end ? { date: { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T00:00:00Z') } } : {}),
      ...(workcenterId ? { workcenterId } : {})
    },
    include: { workcenter: true },
    orderBy: [{ date: 'desc' }],
    take: limit
  });
  return NextResponse.json(list);
}

// 수동 1건 입력
// body: { date, workcenterId, description, totalCpc, flight, salesNo, customerName }
export async function POST(req) {
  const body = await req.json();
  if (!body.date || !body.workcenterId || !body.description || body.totalCpc === undefined) {
    return NextResponse.json({ error: 'date, workcenterId, description, totalCpc는 필수입니다.' }, { status: 400 });
  }
  const entry = await prisma.cpcEntry.create({
    data: {
      date: new Date(body.date + 'T00:00:00Z'),
      workcenterId: body.workcenterId,
      description: body.description,
      totalCpc: Number(body.totalCpc),
      flight: body.flight || null,
      salesNo: body.salesNo || null,
      customerName: body.customerName || null
    }
  });
  return NextResponse.json(entry, { status: 201 });
}
