# 춘천 스파이 게임 - Google Cloud Run용 Dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 복사 및 설치
COPY package*.json ./
RUN npm install --only=production

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 8080

# 서버 실행
CMD ["node", "server.js"]