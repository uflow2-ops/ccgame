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

## 📸 사진/장소 데이터 영구 저장 (중요)

이 게임은 장소 사진과 장소 목록을 서버에 저장합니다. **Render 무료 플랜은 재배포(또는 인스턴스 재시작) 시 파일시스템이 초기화**되므로, 설정 없이 그대로 배포하면 올린 사진과 추가한 장소가 사라집니다.

이를 해결하려면 **Cloudinary**(무료 외부 이미지 호스팅)를 연동하세요. 연동 시:
- 업로드한 사진 → Cloudinary에 저장되어 **재배포 후에도 유지**
- 장소 목록 데이터 → Cloudinary raw 파일로 백업되어 **재배포 후에도 유지**

### Cloudinary 설정 방법
1. https://console.cloudinary.com/ 에서 무료 가입
2. Dashboard에서 `Cloud Name`, `API Key`, `API Secret` 확인
3. 환경변수 설정:
   - **로컬**: `.env.example`을 `.env`로 복사 후 값 입력
   - **Render**: Dashboard → Environment → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` 추가
4. 서버 재시작

> 환경변수를 설정하지 않으면 기존처럼 로컬 `uploads/` 폴더에 저장되며, 콘솔에 경고가 표시됩니다(재배포 시 사라짐).

## 🚀 배포 방법 (무료 호스팅)

### ⚠️ 중요: GitHub Pages는 사용 불가
이 게임은 **Node.js 서버와 Socket.io**가 필요하므로 GitHub Pages에 배포할 수 없습니다.
- GitHub Pages는 정적 파일(HTML, CSS, 이미지)만 호스팅 가능
- 서버 사이드 코드와 실시간 통신이 필요한 이 게임은 Node.js 호스팅 서비스 필요

### 방법 1: Render.com 사용 (추천 ⭐)

1. **GitHub에 코드 업로드**
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/사용자명/저장소명.git
   git push -u origin main
   ```

2. **Render.com에서 배포**
   - https://render.com 회원가입 (GitHub 계정으로 로그인 가능)
   - "New +" → "Web Service" 선택
   - GitHub 저장소 연결
   - 설정:
     - **Name**: 원하는 서비스 이름 (예: chuncheon-spy-game)
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Plan**: Free (무료)
   - "Create Web Service" 클릭

3. **배포 완료 후**
   - Render가 제공하는 URL로 접속 (예: https://chuncheon-spy-game.onrender.com)
   - 이 URL을 학생들에게 공유하면 됩니다!

### 방법 2: Railway.app 사용

1. https://railway.app 회원가입
2. "New Project" → "Deploy from GitHub repo"
3. 저장소 선택
4. 자동 배포 완료!

### 방법 3: Fly.io 사용

```bash
# Fly CLI 설치 후
fly launch
fly deploy
```

## 💻 로컬에서 실행하기

### 필요 조건
- Node.js (v14 이상)

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행
node server.js

# 3. 브라우저에서 접속
# 로컬: http://localhost:3000
# 같은 네트워크: http://192.168.0.152:3000
```

## 🎯 게임 플레이 방법

### 호스트 (게임 만들기)
1. 이름 입력 후 "새 게임 만들기" 클릭
2. 게임 코드를 친구들에게 공유
3. 최소 2명이 모이면 "게임 시작하기" 클릭

### 플레이어 (게임 참가)
1. 이름 입력 후 "게임 참가하기" 클릭
2. 게임 코드 입력
3. 호스트가 게임을 시작하면 자동으로 시작

## 📱 지원 기기
- 태블릿 (추천)
- 스마트폰
- PC (데스크톱/노트북)

## 🛠️ 기술 스택
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **실시간 통신**: Socket.io

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