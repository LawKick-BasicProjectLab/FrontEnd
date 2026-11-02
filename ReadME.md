# Law-Kick Frontend

> 계약서에 서명하기 전에, 먼저 한 번 겪어보기

생활법률 교육 게임 **Law-Kick**의 프론트엔드 레포입니다.
사용자는 만화로 계약 상황을 보고, AI 진행자에게 최대 10번 질문하며(스무고개 방식) 숨은 단서 2개를 찾은 뒤 정답을 고릅니다.

- 코스: 전세 계약 / 알바·근로 계약 / 중고거래 등 3개 코스 (챕터 → 스테이지 구조)
- 보상: 경험치(XP), 킥 코인, 배지, 랭킹
- 면책: 교육용 예시 시나리오이며 법령 요약은 2026년 기준입니다.

> 관련 레포
> - 백엔드: `lawkick-backend`
> - 공유 문서(API 명세·회의록·아키텍처): `lawkick-docs` ← **개발 전에 API 명세부터 확인하세요.**

---

## 1. 기술 스택

| 구분 | 내용 |
|---|---|
| 언어 | HTML / CSS / Vanilla JavaScript (프레임워크·빌드 도구 없음) |
| 폰트 | Google Fonts (Do Hyeon, Gowun Dodum, IBM Plex Sans KR) |
| 상태 저장 | 브라우저 `localStorage` (프로토타입 단계) |
| 서버 통신 | `fetch` → 백엔드 `/api/quiz/*` |
| 배포 | 정적 호스팅 (백엔드와 같은 Vercel 프로젝트에 올리는 경우 `/api` 경로가 같은 도메인) |

## 2. 폴더 구조

`index.html`이 `css/style.css`, `js/data.js`, `js/app.js`를 참조하므로 아래 구조로 맞춰 주세요.

```
.
├── index.html            # 모든 화면(section)이 한 파일에 들어 있는 SPA
├── css/
│   └── style.css         # 전체 스타일
├── js/
│   ├── data.js           # 등장인물(CHARS), 코스·챕터·스테이지(COURSES), 용어집(GLOSSARY)
│   └── app.js            # 화면 전환, 게임 로직, 인증, 랭킹, 서버 통신
└── lawkick_single.html   # 위 파일을 하나로 합친 단일 파일 버전 (데모·공유용)
```

> `lawkick_single.html`은 빌드 산출물 성격입니다. 소스를 수정했다면 단일 파일 버전도 함께 갱신하거나, 갱신하지 않을 경우 README/PR에 명시해 주세요.

## 3. 실행 방법

빌드 과정이 없어서 정적 서버만 있으면 됩니다.

```bash
# 방법 1) Python
python3 -m http.server 3000

# 방법 2) VS Code Live Server 확장 → index.html 우클릭 → Open with Live Server

# 방법 3) 백엔드와 함께 실행 (권장: /api 호출까지 확인 가능)
#   백엔드 레포에서 `vercel dev` 실행 후 접속
```

- 정적 서버만 띄우면 `/api/quiz/*` 호출은 404가 납니다. 서버 연동 기능을 확인하려면 백엔드와 같은 origin에서 실행하세요.
- 서버/AI 연결이 없으면 앱은 **오프라인 모드**로 동작합니다(키워드 매칭 기반 답변).

## 4. 화면 구성

`index.html`의 `<section class="screen">` 단위이며 `go('화면id')`로 전환합니다.

| id | 화면 | 설명 |
|---|---|---|
| `login` / `signup` | 로그인 / 회원가입 | 게스트 둘러보기 지원 |
| `home` | 홈 | 레벨·경험치·코인, 이어하기, 코스 선택 |
| `course` | 코스 | 챕터·스테이지 목록, 잠금 상태 |
| `stage` | 스테이지 소개 | 만화(SVG 패널) + 문제 + 글자 크기 조절 |
| `play` | 플레이 | AI 진행자와 질문/답변(10회), 단서 표시 |
| `answer` | 정답 선택 | 보기 선택, 이미 고른 답 비활성화 |
| `feedback` | 피드백 | 정오답, 해설, 관련 법령, AI 분석 피드백 |
| `shorts` | 쇼츠 몰아보기 | 챕터별 1분 배경지식 릴 |
| `rank` | 랭킹 | 경험치 순위 |
| `my` | 마이페이지 | 배지, 진행 이력, 로그아웃/초기화 |

## 5. 스테이지 데이터 규격 (`js/data.js`)

백엔드에서 받는 맞춤형 문제도 이 형식으로 변환해서 사용합니다. 자세한 API 규격은 `lawkick-docs`를 참고하세요.

```js
{
  id: 'j1-1',
  title: '스테이지 제목',
  q: '문제 지문',
  comic: [ /* 패널: [장면, [[인물, 표정, 위치]], 내레이션, [[말하는 인물, 대사]]] */ ],
  opts: [
    ['보기 텍스트', 1, ''],            // [텍스트, 정답여부(1/0), 오답일 때 해설]
    ['보기 텍스트', 0, '오답 해설']
  ],
  explain: '정답 해설',
  laws: [['법령 이름', '조항 내용']],
  clues: [
    { id: 'a', label: '단서 이름', hint: '힌트', kw: ['키워드'], fact: 'AI에게 주는 사실', reveal: '플레이어에게 보여줄 답변' }
  ]
}
```

## 6. 로컬 저장소 키 (프로토타입)

| 키 | 내용 |
|---|---|
| `lk_accounts` | 가입한 계정 목록 (닉네임, 이메일, 해시된 비밀번호, 랭킹 공개 여부) |
| `lk_session` | 현재 로그인 세션 |
| `lk_prog_<email>` | 사용자별 진행도 `{xp, coins, cleared, seen, badges, hist, visits}` |

> 계정 정보가 서버가 아닌 브라우저에만 저장됩니다. 실서비스에서는 서버 인증으로 교체해야 합니다.

## 7. 백엔드 연동 현황

| 함수 (`js/app.js`) | 호출 API | 상태 |
|---|---|---|
| `submitQuizResult(stageId, category, isCorrect, triesCount)` | `POST /api/quiz/submit` | 함수 구현됨 · 정답 판정 시점 호출 연결 여부 확인 필요 |
| `loadCustomQuiz()` | `POST /api/quiz/custom` | 구현됨 · 현재 `weakCategory`가 `'전세 계약'`으로 고정 |
| `fetchCustomQuiz(userId, weakCategory)` | `POST /api/quiz/custom` | 렌더링 미연결(TODO) · `loadCustomQuiz`와 중복이므로 하나로 정리 필요 |
| `aiAsk(q)` / `aiFeedback()` | (미정) | 현재 실행 환경이 주입하는 `AI.sample` 객체에 의존. 일반 호스팅에서는 오프라인 모드로 동작 |
| `syncRank()` / `renderRank()` | (미정) | 현재 `AI.db`에 의존. 일반 호스팅에서는 이 기기의 로컬 데이터 + 예시 사용자 표시 |

## 8. TODO

- [ ] `submitQuizResult` 호출을 정답/오답 확정 시점에 연결
- [ ] `loadCustomQuiz`에서 사용자의 실제 취약 카테고리(오답 이력 기반)를 전달
- [ ] AI 진행자 질문 / AI 피드백을 백엔드 API로 이전 (명세는 `lawkick-docs`에서 합의)
- [ ] 랭킹을 백엔드 API로 이전
- [ ] 로컬 인증 → 서버 인증 전환
- [ ] 맞춤 문제 생성 중 로딩/실패 UI 개선 (현재 `alert` 사용)
- [ ] `fetchCustomQuiz` / `loadCustomQuiz` 중복 정리
- [ ] 접근성 점검 (글자 크기 조절은 구현됨, 스크린리더·대비 확인 필요)

## 9. 협업 규칙

- **API 명세가 먼저입니다.** 요청/응답 형식을 바꿔야 하면 코드보다 먼저 `lawkick-docs`의 명세를 PR로 수정하고 백엔드 팀 리뷰를 받습니다.
- 브랜치: `main`(배포) ← `dev` ← `feature/기능명`
- 커밋 메시지: `feat:` / `fix:` / `style:` / `refactor:` / `docs:` 접두사 사용
- PR은 최소 1명 리뷰 후 병합합니다.
- 사용자 입력을 `innerHTML`에 넣을 때는 반드시 `esc()`로 이스케이프합니다.
- API 키·비밀번호 등 비밀 값은 프론트엔드 코드에 절대 넣지 않습니다.
