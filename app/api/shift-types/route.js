import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET() {
  const types = await prisma.shiftType.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json(types);
}

export async function POST(req) {
  const body = await req.json();
  if (!body.code || !body.startTime || !body.endTime || body.hours === undefined || body.hours === null || body.hours === '') {
    return NextResponse.json({ error: 'code, startTime, endTime, hours는 필수입니다.' }, { status: 400 });
  }
  const count = await prisma.shiftType.count();
  const shiftType = await prisma.shiftType.create({
    data: {
      code: String(body.code).trim(),
      startTime: body.startTime,
      endTime: body.endTime,
      hours: Number(body.hours),
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : count + 1
    }
  });
  return NextResponse.json(shiftType, { status: 201 });
}
