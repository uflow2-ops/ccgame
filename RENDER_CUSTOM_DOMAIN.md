# Render 커스텀 도메인 가이드

## 1. 커스텀 도메인 준비
- 개인 도메인 (예: `ccgame.kr`, `ccgame.ga` 등)
- 무료 도메인: `freenom.com` (무료 .tk, .ml, .ga, .cf, .gq 도메인)

## 2. Render에서 커스텀 도메인 추가
1. Render 대시보드 (https://dashboard.render.com) 로그인
2. `ccgame` 앱 선택
3. "Settings" → "Custom Domains" 클릭
4. 도메인 추가 (예: `ccgame.yourdomain.com`)

## 3. DNS 설정
- 도메인 관리 페이지에서 CNAME 레코드 추가
- `CNAME` → `cname.vercel-dns.com` (Render에서 제공하는 값)

## 4. SSL 인증서 자동 발급
- Render에서 자동으로 SSL 인증서 발급
- `https://ccgame.yourdomain.com` 으로 접속 가능

## 5. 방화벽 우회
- `onrender.com` 도메인이 아닌 커스텀 도메인으로 접속
- 학교 방화벽에서 차단되지 않을 수 있음

## 주의사항
- Render 무료 플랜에서도 커스텀 도메인 지원
- 도메인 구매 비용 또는 무료 도메인 사용
- DNS 설정에 시간이 소요될 수 있음 (최대 48시간)