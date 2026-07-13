# Cloudflare Tunnel 가이드 (Render 우회)

## 1. Cloudflare 계정 생성
- https://dash.cloudflare.com 에서 무료 계정 생성

## 2. Cloudflare Tunnel 설치
```bash
# Windows (PowerShell)
winget install --id Cloudflare.Warp --accept-source-agreements --accept-package-agreements

# 또는 직접 다운로드
# https://github.com/cloudflare/cloudflared/releases/latest
```

## 3. Cloudflare Tunnel 실행
```bash
# Cloudflare 로그인
cloudflared tunnel login

# Tunnel 생성
cloudflared tunnel create ccgame-tunnel

# 인증 파일 확인
# C:\Users\[사용자명]\.cloudflared\[터널ID].json
```

## 4. Tunnel 설정 (config.yml)
```yaml
tunnel: ccgame-tunnel
credentials-file: C:\Users\[사용자명]\.cloudflared\[터널ID].json

ingress:
  - hostname: ccgame.[도메인].cloudflareaccess.com
    service: https://[Render URL]
  - service: http_status:404
```

## 5. Tunnel 실행
```bash
cloudflared tunnel --config config.yml run
```

## 6. 접속 방법
- `https://ccgame.[도메인].cloudflareaccess.com` 으로 접속
- `onrender.com` 도메인을 완전히 우회

## 주의사항
- Cloudflare Tunnel은 외부에서 접속 가능한 도메인을 생성
- 학교 방화벽에서 `cloudflareaccess.com` 도메인이 차단되지 않을 수 있음
- Render 서버는 그대로 유지하면서 별도 도메인으로 접속 가능
- Tunnel이 실행 중인 PC가 있어야 함 (교사 PC 또는 별도 서버)