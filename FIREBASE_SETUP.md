# Firebase 이전 설정 가이드

## 📋 준비 완료된 파일

### 1. Firebase Functions (functions/index.js)
- ✅ Express 서버로 API 구현
- ✅ Realtime Database 연동
- ✅ Cloudinary 이미지 업로드 지원
- ✅ 장소 관리 API (추가/수정/삭제)
- ✅ 방 관리 API

### 2. Firebase Hosting 설정 (firebase.json)
- ✅ Functions와 연동
- ✅ 정적 파일 호스팅

### 3. Firebase 프로젝트 설정 (.firebaserc)
- ✅ 프로젝트 ID 입력 필요

### 4. Firebase 클라이언트 파일
- ✅ index.html - Firebase SDK 연동
- ✅ teacher.html - Firebase SDK 연동
- ✅ locations.html - Firebase SDK 연동
- ✅ client-firebase.js - RTDB 실시간 통신

## 🚀 배포 전 체크리스트

### 1. Firebase 프로젝트 생성
- [ ] https://console.firebase.google.com/ 에서 프로젝트 생성
- [ ] 프로젝트 ID 확인

### 2. .firebaserc 수정
```bash
# .firebaserc 파일에서 YOUR_FIREBASE_PROJECT_ID를 실제 프로젝트 ID로 변경
```

### 3. Firebase 구성 입력
다음 파일들에서 `YOUR_API_KEY` 등을 실제 Firebase 구성으로 변경:
- [ ] index.html (14번째 줄)
- [ ] teacher.html (332번째 줄)
- [ ] locations.html (108번째 줄)
- [ ] client-firebase.js (6번째 줄)

### 4. Realtime Database 규칙 설정
Firebase Console → Build → Realtime Database → 규칙에 다음 입력:
```json
{
  "rules": {
    "locations": {
      ".read": true,
      ".write": true
    },
    "lobby": {
      ".read": true,
      ".write": true
    },
    "games": {
      ".read": true,
      ".write": true
    },
    "teacher": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 5. Cloudinary 환경 변수 설정 (선택사항)
Firebase Console → Functions → 환경 변수에 추가:
- [ ] CLOUDINARY_CLOUD_NAME
- [ ] CLOUDINARY_API_KEY
- [ ] CLOUDINARY_API_SECRET

### 6. 배포
```bash
# Firebase CLI 로그인
firebase login

# Functions 배포
firebase deploy --only functions

# Hosting 배포
firebase deploy --only hosting
```

## 📝 주의사항

1. **기존 server.js**는 Firebase 이전용으로 보존됩니다. 필요시 백업 후 삭제 가능
2. **client.js**는 Socket.io 버전으로 보존됩니다. Firebase 버전은 client-firebase.js 사용
3. **locations.json**은 로컬 백업용으로 보존됩니다. Firebase RTDB에서 관리

## 🔗 배포 후 확인

1. Firebase Console → Hosting에서 제공하는 URL 확인
2. 교사 페이지: `https://[PROJECT_ID].web.app/teacher.html`
3. 학생 페이지: `https://[PROJECT_ID].web.app/`
4. 장소 관리: `https://[PROJECT_ID].web.app/locations.html`