import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function PUT(req, { params }) {
  const body = await req.json();
  const shiftType = await prisma.shiftType.update({
    where: { id: params.id },
    data: {
      ...(body.code !== undefined ? { code: String(body.code).trim() } : {}),
      ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
      ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
      ...(body.hours !== undefined ? { hours: Number(body.hours) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {})
    }
  });
  return NextResponse.json(shiftType);
}

export async function DELETE(req, { params }) {
  await prisma.shiftType.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
