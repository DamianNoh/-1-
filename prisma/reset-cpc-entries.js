// 날짜 하루씩 밀림 버그로 잘못 들어간 CPC 원본 데이터를 전부 지우는 1회성 스크립트입니다.
// 워크센터/근무 인원/관리 인력 데이터는 건드리지 않고 CpcEntry(원본 CPC) 데이터만 삭제합니다.
// 실행: node prisma/reset-cpc-entries.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.cpcEntry.deleteMany({});
  console.log(`CPC 원본 데이터 ${result.count}건 삭제 완료. 이제 엑셀을 다시 업로드해주세요.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
