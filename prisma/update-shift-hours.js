// 이미 등록된 시프트 코드 7종의 근무시간에서 휴게시간 1시간을 빼는 1회성 스크립트.
// (근무시간 기준 CPC 계산에서 휴게시간이 포함되어 있던 문제 수정)
// 기존 행을 삭제하지 않고 hours 값만 업데이트하므로, 이미 입력된 인원수(ShiftCount) 데이터는 그대로 유지됩니다.
// 실행: node prisma/update-shift-hours.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NEW_HOURS = {
  AA: 8, // 06:00~15:00 (9시간) - 휴게 1시간
  AS: 7, // 08:00~16:00 (8시간) - 휴게 1시간
  A: 8,  // 08:00~17:00 (9시간) - 휴게 1시간
  AN: 9, // 08:00~18:00 (10시간) - 휴게 1시간
  N: 8,  // 10:00~19:00 (9시간) - 휴게 1시간
  P: 8,  // 13:00~22:00 (9시간) - 휴게 1시간
  D: 10  // 08:00~19:00 (11시간) - 휴게 1시간
};

async function main() {
  const existing = await prisma.shiftType.findMany();
  let updated = 0;
  for (const st of existing) {
    if (Object.prototype.hasOwnProperty.call(NEW_HOURS, st.code)) {
      const newHours = NEW_HOURS[st.code];
      if (st.hours !== newHours) {
        await prisma.shiftType.update({ where: { id: st.id }, data: { hours: newHours } });
        console.log(`${st.code}: ${st.hours}시간 -> ${newHours}시간`);
        updated++;
      } else {
        console.log(`${st.code}: 이미 ${newHours}시간 (변경 없음)`);
      }
    } else {
      console.log(`${st.code}: NEW_HOURS 목록에 없어 건너뜀 (수동 확인 필요)`);
    }
  }
  console.log(`완료: ${updated}건 업데이트`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
