import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function DELETE(_req, { params }) {
  await prisma.cpcEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
