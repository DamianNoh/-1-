import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function PUT(req, { params }) {
  try {
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
  } catch (err) {
    const isUniqueError = err && err.code === 'P2002';
    return NextResponse.json(
      { error: isUniqueError ? '이미 사용 중인 코드입니다.' : '수정 중 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err)) },
      { status: isUniqueError ? 409 : 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  await prisma.shiftType.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
