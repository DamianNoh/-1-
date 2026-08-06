import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET() {
  const list = await prisma.workcenter.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json(list);
}

export async function POST(req) {
  const body = await req.json();
  if (!body.code || !body.label) {
    return NextResponse.json({ error: 'code, label은 필수입니다.' }, { status: 400 });
  }
  const count = await prisma.workcenter.count();
  const wc = await prisma.workcenter.create({
    data: {
      code: body.code,
      label: body.label,
      color: body.color || '#334155',
      sortOrder: body.sortOrder ?? count + 1
    }
  });
  return NextResponse.json(wc, { status: 201 });
}
