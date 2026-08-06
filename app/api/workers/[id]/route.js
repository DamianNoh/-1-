import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function PUT(req, { params }) {
  const body = await req.json();
  const worker = await prisma.worker.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.workcenterId !== undefined ? { workcenterId: body.workcenterId } : {}),
      ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  });
  return NextResponse.json(worker);
}

export async function DELETE(_req, { params }) {
  // 실제 삭제 대신 비활성화 (과거 CPC 계산 이력 보존)
  await prisma.worker.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
