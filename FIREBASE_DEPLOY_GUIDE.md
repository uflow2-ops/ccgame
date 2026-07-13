# Firebase 배포 가이드 (Spark 무료 플랜)

## 📋 준비 사항

1. **Firebase 프로젝트 생성**
   - [Firebase 콘솔](https://console.firebase.google.com/)에 접속
   - 새 프로젝트 생성 또는 기존 프로젝트 선택
   - 프로젝트 ID를 확인 (예: `chuncheon-spy-game`)

2. **Firebase CLI 설치**
   ```bash
   npm install -g firebase-tools
   ```

3. **Firebase 로그인**
   ```bash
   firebase login
   ```

## 🔧 설정 변경

### 1. `.firebaserc` 수정
`YOUR_PROJECT_ID`를 실제 Firebase 프로젝트 ID로 변경:
```json
{
  "projects": {
    "default": "실제_프로젝트_ID"
  }
}
```

### 2. `firebase-config.js` 생성
`firebase-config.js` 파일을 생성하고 Firebase 설정을 입력합니다. 이 파일은 `.gitignore`에 포함되어 GitHub에 업로드되지 않습니다.

```javascript
// firebase-config.js
const firebaseConfig = {
    apiKey: "실제_API_KEY",
    authDomain: "실제_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://실제_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "실제_PROJECT_ID",
    storageBucket: "실제_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "실제_SENDER_ID",
    appId: "실제_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();
```

Firebase 콘솔 → 프로젝트 설정 → 앱 추가 → SDK 설정에서 확인할 수 있습니다.

## 🚀 배포 방법

### 1. Firebase 초기화
```bash
firebase init
```
- Hosting 선택
- 기존 프로젝트 선택 또는 생성
- public 디렉토리: `public`
- SPA 설정: `y` (단일 페이지 앱)

### 2. 배포
```bash
firebase deploy
```

## 📊 Firebase Realtime Database 규칙

Firebase 콘솔 → Realtime Database → 규칙에서 다음 규칙을 설정:

```json
{
  "rules": {
    "lobby": {
      "$uid": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['name', 'joinedAt'])"
      }
    },
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['status', 'players', 'descriptions', 'votes'])"
      }
    },
    "locations": {
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

> **주의**: Spark(무료) 플랜에서는 인증 없이 데이터베이스에 접근할 수 있습니다. 보안이 필요한 경우 Blaze 플랜으로 업그레이드하거나 인증을 추가해야 합니다.

## 💰 Spark 플랜 무료 할당량

- **Realtime Database**: 1GB 저장 용량, 10GB 다운로드
- **Storage**: 5GB 저장 용량, 1GB 다운로드
- **Hosting**: 10GB 저장 용량, 10GB 전송

일반적인 수업용으로는 충분합니다.

## 📝 주요 변경 사항

1. **Socket.io → Firebase Realtime Database**
   - 실시간 통신을 Firebase Database의 `on('value')` 이벤트로 대체
   - 서버리스 구조로 변경되어 비용 0원

2. **이미지 저장**
   - Cloudinary 대신 Firebase Storage 사용
   - 이미지는 Base64 또는 Firebase Storage에 저장

3. **게임 로직**
   - 서버에서 처리하던 로직을 클라이언트에서 분산 처리
   - 교사가 게임 시작 시 방 생성 및 스파이 할당
   - 학생들이 실시간으로 설명 작성 및 투표

## 🔗 배포 후 확인

배포가 완료되면 다음 URL에서 게임을 확인할 수 있습니다:
- `https://프로젝트_ID.web.app`
- `https://프로젝트_ID.firebaseapp.com`

교사용: `/teacher.html`
학생용: `/index.html`
장소 관리: `/locations.html`