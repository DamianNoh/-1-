import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const workcenterId = searchParams.get('workcenterId');
  const workers = await prisma.worker.findMany({
    where: {
      active: true,
      ...(workcenterId ? { workcenterId } : {})
    },
    include: { workcenter: true, weeklySchedules: true },
    orderBy: { createdAt: 'asc' }
  });
  return NextResponse.json(workers);
}

export async function POST(req) {
  const body = await req.json();
  if (!body.name || !body.workcenterId) {
    return NextResponse.json({ error: 'name, workcenterId는 필수입니다.' }, { status: 400 });
  }
  const worker = await prisma.worker.create({
    data: {
      name: body.name,
      workcenterId: body.workcenterId,
      employmentType: body.employmentType === 'PARTTIME' ? 'PARTTIME' : 'FULLTIME'
    }
  });
  return NextResponse.json(worker, { status: 201 });
}
