// 초기 워크센터 3개 + 기본 시프트 코드 7종 시딩
// 실행: node prisma/seed.js  (또는 package.json에 "prisma": {"seed": "node prisma/seed.js"} 추가 후 npx prisma db seed)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workcenters = [
    { code: 'P1-BAR Packing', label: '베버리지', sortOrder: 1, color: '#6366f1' },
    { code: 'P3-Headsets', label: '헤드셋', sortOrder: 2, color: '#14b8a6' },
    { code: 'P4-Consumable/Dry goods', label: '컨테이너', sortOrder: 3, color: '#f59e0b' }
  ];

  for (const wc of workcenters) {
    await prisma.workcenter.upsert({
      where: { code: wc.code },
      update: { label: wc.label, sortOrder: wc.sortOrder, color: wc.color },
      create: wc
    });
  }

  const shiftTypes = [
    { code: 'AA', startTime: '06:00', endTime: '15:00', hours: 9, sortOrder: 1 },
    { code: 'AS', startTime: '08:00', endTime: '16:00', hours: 8, sortOrder: 2 },
    { code: 'A', startTime: '08:00', endTime: '17:00', hours: 9, sortOrder: 3 },
    { code: 'AN', startTime: '08:00', endTime: '18:00', hours: 10, sortOrder: 4 },
    { code: 'N', startTime: '10:00', endTime: '19:00', hours: 9, sortOrder: 5 },
    { code: 'P', startTime: '13:00', endTime: '22:00', hours: 9, sortOrder: 6 },
    { code: 'D', startTime: '08:00', endTime: '19:00', hours: 11, sortOrder: 7 }
  ];

  for (const st of shiftTypes) {
    await prisma.shiftType.upsert({
      where: { code: st.code },
      update: { startTime: st.startTime, endTime: st.endTime, hours: st.hours, sortOrder: st.sortOrder },
      create: st
    });
  }

  console.log('워크센터 + 시프트 코드 시드 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
