This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Environment variables (this project)

Vercel **Project → Settings → Environment Variables**에 아래를 설정하세요. 자세한 설명은 [`.env.example`](./.env.example) 참고.

| Name | Required | Notes |
|------|----------|--------|
| `BACKEND_URL` | 권장 | 백엔드 루트 URL (`https://...`, 끝 `/` 없음) |
| `API_BASE` | 일부 라우트 | `records` 등; 없으면 `BACKEND_URL`과 동일 값 권장 |
| `API_KEY` | 예 | 백엔드 `x-api-key` |
| `ADMIN_PASSWORD` | 예 | 관리자 로그인 |
| `UPSTREAM_FETCH_TIMEOUT_MS` | 아니오 | 백엔드 fetch 타임아웃(ms), 기본 25000 |
| `UPSTREAM_LOG` | 아니오 | `0`이면 upstream 에러 콘솔 로그 비활성화 |

배포 전 로컬에서 `npm run build`로 한 번 확인하는 것을 권장합니다.
