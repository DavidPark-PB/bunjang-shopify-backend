# 번개장터 API 설정 가이드

## 📌 번개장터 API 인증 방식

번개장터 API는 **JWT (JSON Web Token)** 기반 인증을 사용합니다.

공식 문서: https://api.bgzt.guide/doc-662202

## 🔑 필요한 정보

번개장터 파트너 계약 후 다음 정보를 받게 됩니다:

1. **Access Key** - API 접근 키
2. **Secret Key** - JWT 서명용 비밀키

## ⚙️ 환경 변수 설정

### 1. JWT 패키지 설치

먼저 JWT 관련 패키지를 설치해야 합니다:

#### Windows (명령 프롬프트)
```cmd
cd c:\BunjangAPI\backend
npm install jsonwebtoken uuid
```

또는 제공된 배치 파일 실행:
```cmd
INSTALL_JWT_PACKAGES.bat
```

### 2. .env 파일 설정

`.env` 파일을 열고 다음 값을 입력하세요:

```env
# Bunjang API Configuration
BUNJANG_API_URL=https://openapi.bunjang.co.kr

# JWT Authentication
BUNJANG_ACCESS_KEY=your_actual_access_key
BUNJANG_SECRET_KEY=your_actual_secret_key
```

**실제 값으로 교체하세요:**
- `your_actual_access_key` → 번개장터에서 받은 Access Key
- `your_actual_secret_key` → 번개장터에서 받은 Secret Key

## 🔐 JWT Token 생성 방식

코드에서 자동으로 JWT 토큰을 생성합니다:

### Token Payload 구조

```json
{
  "accessKey": "your_access_key",
  "iat": 1705234567,
  "nonce": "uuid-v4-string"  // POST, PUT, DELETE만 포함
}
```

### Token 특징

- **알고리즘**: HS256
- **유효기간**: 5초
- **Nonce**: POST, PUT, DELETE 메서드만 포함
- **매 요청마다 새로운 토큰 생성**

## 📡 API 사용 예시

### 상품 목록 조회 (GET)

서버가 자동으로 JWT 토큰을 생성하여 요청합니다:

```http
GET /api/v1/products HTTP/1.1
Host: openapi.bunjang.co.kr
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### 주문 생성 (POST)

POST 메서드는 nonce가 포함된 토큰을 생성합니다:

```http
POST /api/v1/orders HTTP/1.1
Host: openapi.bunjang.co.kr
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "productId": "123456",
  "quantity": 1
}
```

## 🧪 인증 테스트

서버 시작 시 자동으로 인증 설정을 확인합니다:

```bash
npm run dev
```

**예상 로그 출력:**
```
Bunjang Auth service initialized
JWT Token generated for GET method
Bunjang Auth setup verified successfully
```

만약 에러가 발생하면:
```
Bunjang accessKey or secretKey not configured
Bunjang Auth setup verification failed
```

→ `.env` 파일의 `BUNJANG_ACCESS_KEY`와 `BUNJANG_SECRET_KEY` 값을 확인하세요.

## 🔍 실제 API 엔드포인트

### 번개장터 API 문서 확인 필요

현재 공개된 정보:
- Base URL: `https://openapi.bunjang.co.kr` (추정)
- 인증: JWT Bearer Token

**파트너 계약 후 확인해야 할 정보:**
1. 실제 Base URL
2. 사용 가능한 엔드포인트 목록
3. 요청/응답 데이터 구조
4. Rate Limiting 정책

### 번개장터에 문의

API 상세 정보는 다음 연락처로 문의하세요:
- 이메일: partner_global@bunjang.co.kr
- 제목: "API 문서 및 엔드포인트 정보 요청"

## 📊 데이터 구조 업데이트

실제 API 응답을 받은 후 다음 파일을 업데이트해야 할 수 있습니다:

### `backend/services/bunjangService.js`

`transformToShopifyFormat()` 메서드의 필드 매핑을 실제 응답 구조에 맞게 수정:

```javascript
transformToShopifyFormat(bunjangProduct) {
  return {
    // 실제 번개장터 API 응답 필드명으로 수정 필요
    id: bunjangProduct.id || bunjangProduct.pid,
    title: bunjangProduct.name || bunjangProduct.title,
    price: bunjangProduct.price,
    images: bunjangProduct.images || bunjangProduct.photos,
    // ... 등등
  };
}
```

## ⚠️ 주의사항

### 1. Secret Key 보안
- `.env` 파일을 절대 Git에 커밋하지 마세요
- Secret Key를 공개하지 마세요
- 프로덕션과 개발 환경의 키를 분리하세요

### 2. Token 만료
- JWT 토큰은 5초 후 만료됩니다
- 코드에서 매 요청마다 새 토큰을 자동 생성합니다
- 수동으로 토큰을 재사용하지 마세요

### 3. API Rate Limiting
- 번개장터 API의 Rate Limit 정책을 확인하세요
- 필요시 요청 간 딜레이를 추가하세요

## 🐛 트러블슈팅

### 문제 1: "Bunjang accessKey or secretKey not configured"

**원인**: 환경 변수가 설정되지 않음

**해결**:
```bash
# .env 파일 확인
type .env

# Access Key와 Secret Key가 설정되어 있는지 확인
```

### 문제 2: "JWT token generation failed"

**원인**: `jsonwebtoken` 패키지가 설치되지 않음

**해결**:
```bash
npm install jsonwebtoken uuid
```

### 문제 3: 401 Unauthorized

**원인**:
- Access Key 또는 Secret Key가 잘못됨
- 토큰이 만료됨
- API URL이 잘못됨

**해결**:
1. 번개장터 파트너 대시보드에서 키 확인
2. `.env` 파일 값 재확인
3. `BUNJANG_API_URL` 확인

### 문제 4: 404 Not Found

**원인**: API 엔드포인트 URL이 잘못됨

**해결**:
1. 번개장터 API 문서에서 정확한 엔드포인트 확인
2. `backend/services/bunjangService.js`의 URL 수정

## 📞 지원

추가 지원이 필요하면:
- 번개장터 파트너 이메일: partner_global@bunjang.co.kr
- API 문서: https://api.bgzt.guide/

---

**JWT 인증 설정 완료!** 🎉

이제 서버를 시작하면 자동으로 JWT 토큰이 생성되어 번개장터 API에 요청됩니다.
