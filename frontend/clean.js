const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 컬러 출력 헬퍼 함수
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

log('🧹 Vue 프로젝트 정리 및 초기화 시작', colors.blue);
log('================================================', colors.blue);

try {
  // 1. node_modules 디렉토리 삭제
  log('1. node_modules 디렉토리 삭제 중...', colors.yellow);
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    log('   ✅ node_modules 삭제 완료', colors.green);
  } else {
    log('   ℹ️ node_modules 디렉토리가 이미 없습니다', colors.blue);
  }

  // 2. package-lock.json 삭제
  log('2. package-lock.json 삭제 중...', colors.yellow);
  const packageLockPath = path.join(__dirname, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    fs.unlinkSync(packageLockPath);
    log('   ✅ package-lock.json 삭제 완료', colors.green);
  } else {
    log('   ℹ️ package-lock.json 파일이 이미 없습니다', colors.blue);
  }

  // 3. vue-template-compiler 디렉토리 직접 삭제 (npm uninstall로 제거되지 않는 경우를 대비)
  log('3. vue-template-compiler 디렉토리 삭제 중...', colors.yellow);
  const vueTemplateCompilerPath = path.join(nodeModulesPath, 'vue-template-compiler');
  if (fs.existsSync(vueTemplateCompilerPath)) {
    fs.rmSync(vueTemplateCompilerPath, { recursive: true, force: true });
    log('   ✅ vue-template-compiler 디렉토리 삭제 완료', colors.green);
  } else {
    log('   ℹ️ vue-template-compiler 디렉토리가 이미 없습니다', colors.blue);
  }

  // 4. npm 캐시 정리
  log('4. npm 캐시 정리 중...', colors.yellow);
  execSync('npm cache clean --force', { stdio: 'inherit' });
  log('   ✅ npm 캐시 정리 완료', colors.green);

  // 5. 의존성 설치
  log('5. 의존성 설치 중...', colors.yellow);
  execSync('npm install', { stdio: 'inherit' });
  log('   ✅ 의존성 설치 완료', colors.green);

  log('================================================', colors.blue);
  log('🎉 초기화가 완료되었습니다!', colors.green);
  log('이제 다음 명령어를 실행하세요:', colors.blue);
  log('npm run serve', colors.green);
  
} catch (error) {
  log('❌ 오류 발생: ' + error.message, colors.red);
  process.exit(1);
} 