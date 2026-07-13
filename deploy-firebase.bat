@echo off
echo 🚀 Firebase 배포 스크립트
echo ==========================

echo.
echo 1. Firebase Functions 배포 중...
firebase deploy --only functions

echo.
echo 2. Firebase Hosting 배포 중...
firebase deploy --only hosting

echo.
echo ✅ 배포 완료!
echo.
echo 다음 단계:
echo - Firebase Console에서 Realtime Database 규칙 확인
echo - Cloudinary 환경 변수 설정 (선택사항)
echo - index.html, teacher.html, locations.html, client-firebase.js에 Firebase 구성 입력
pause