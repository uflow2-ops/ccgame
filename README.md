# 🕵️ 춘천 스파이 게임 (Chuncheon Spy Game)

춘천의 장소를 주제로 한 멀티플레이어 스파이 게임입니다. 학생들이 동시에 접속하여 스파이를 찾는 재미있는 게임입니다!

## 🎮 게임 규칙

1. **게임 참가**: 2명 이상의 플레이어가 게임에 참가합니다
2. **역할 할당**: 
   - 1명의 스파이 (춘천 장소를 모름)
   - 나머지 시민들 (각자 랜덤 춘천 장소 할당)
3. **설명 작성**: 각자 받은 장소에 대한 설명을 작성합니다
4. **설명 확인**: 모든 플레이어의 설명을 읽어봅니다
5. **투표**: 스파이로 의심되는 사람을 투표합니다
6. **결과**:
   - 스파이를 잡으면 시민 승리! 🎉
   - 스파이를 못 찾으면 스파이 승리! 🕵️

## 🚀 Firebase 배포 방법 (추천 ⭐)

### 1. Firebase 프로젝트 생성
1. https://console.firebase.google.com/ 에서 프로젝트 생성
2. 프로젝트 ID를 기록해두세요 (예: `chuncheon-spy-game`)

### 2. Firebase CLI 설치 및 로그인
```bash
npm install -g firebase-tools
firebase login
```

### 3. 프로젝트 설정
`.firebaserc` 파일에 프로젝트 ID 입력:
```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

### 4. Realtime Database 활성화
1. Firebase Console → Build → Realtime Database
2. 데이터베이스 생성 (테스트 모드 권장)
3. 규칙 설정:
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

### 5. Cloudinary 설정 (선택사항 - 이미지 영구 저장)
1. https://console.cloudinary.com/ 에서 무료 가입
2. Firebase Console → Functions → 환경 변수 설정:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 6. 배포
```bash
# Functions 배포
firebase deploy --only functions

# Hosting 배포
firebase deploy --only hosting
```

### 7. Firebase 구성 입력
`index.html`, `teacher.html`, `locations.html`, `client-firebase.js` 파일에서 Firebase 구성을 입력하세요:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

## 📱 지원 기기
- 태블릿 (추천)
- 스마트폰
- PC (데스크톱/노트북)

## 🛠️ 기술 스택
- **Backend**: Firebase Functions, Firebase Realtime Database
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **실시간 통신**: Firebase Realtime Database
- **이미지 저장**: Cloudinary (선택사항)

## 📝 주요 기능
- ✅ 실시간 멀티플레이어
- ✅ 게임 코드로 간편 참가
- ✅ 8개의 춘천 장소 (남춘천역, 공지천, 소양강 스카이워크, 닭갈비 골목 등)
- ✅ 태블릿 최적화 UI
- ✅ 실시간 채팅 및 진행 상황 표시
- ✅ 투표 시스템
- ✅ 결과 화면 with 통계

## 🎓 교육적 활용
- 춘천 지역 사회 과목에서 활용
- 팀워크 및 추리 능력 향상
- 지역 장소 학습

## 📄 라이선스
MIT License

## 👨‍💻 제작
춘천 교육용 게임으로 제작되었습니다.