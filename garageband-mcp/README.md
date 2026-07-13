# garageband-mcp

Claude Code에서 Apple **GarageBand**를 제어할 수 있게 해주는 MCP(Model Context Protocol) 서버입니다.

GarageBand는 공식 AppleScript API(스크립팅 사전)가 거의 없기 때문에, 이 서버는 macOS의
**System Events UI 스크립팅**(메뉴 클릭 + 키보드 단축키)으로 GarageBand를 조작합니다.
따라서 **macOS 전용**이며, GarageBand가 화면에 떠 있는 상태에서 동작합니다.

## 요구 사항

- macOS + GarageBand 설치
- Node.js 18 이상 (`node -v`로 확인)
- **손쉬운 사용(Accessibility) 권한** — 아래 설정 필수

## 설치

```bash
cd garageband-mcp
npm install
```

### Claude Code에 등록

```bash
claude mcp add garageband -- node /절대/경로/garageband-mcp/index.js
```

예를 들어 이 저장소를 `~/snake-math_claude`에 클론했다면:

```bash
claude mcp add garageband -- node ~/snake-math_claude/garageband-mcp/index.js
```

등록 확인:

```bash
claude mcp list
```

### 손쉬운 사용 권한 설정 (필수)

키 입력과 메뉴 클릭은 macOS 접근성 API를 사용하므로, **Claude Code를 실행하는 터미널 앱**에
권한을 줘야 합니다:

1. **시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용** 열기
2. Terminal(또는 iTerm2, VS Code 등 Claude Code를 실행하는 앱)을 목록에 추가하고 켜기
3. 첫 도구 호출 시 자동화(Automation) 권한 팝업이 뜨면 **허용**

권한이 없으면 도구 호출 시 안내 메시지와 함께 실패합니다.
`garageband_status` 도구로 권한 상태(`accessibilityEnabled`)를 확인할 수 있습니다.

## 사용 예시

Claude Code에서 이렇게 말하면 됩니다:

- "개러지밴드 켜줘"
- "새 소프트웨어 악기 트랙 만들어줘"
- "재생해봐" / "정지해"
- "메트로놈 켜고 녹음 시작해줘"
- "프로젝트 저장하고 mp3로 내보내줘"

## 제공 도구 (20개)

### 앱/프로젝트 제어
| 도구 | 설명 |
|---|---|
| `garageband_status` | 실행 여부, 앞쪽 윈도우 이름, 접근성 권한 상태 확인 |
| `launch_garageband` | GarageBand 실행 |
| `quit_garageband` | GarageBand 종료 |
| `open_project` | `.band` 프로젝트 또는 오디오/MIDI 파일 열기 |
| `save_project` | 저장 (Cmd+S) |

### 트랜스포트(재생/녹음)
| 도구 | 설명 |
|---|---|
| `play_pause` | 재생/정지 토글 (Space) |
| `toggle_record` | 녹음 시작/중지 (R) |
| `go_to_beginning` | 재생 헤드를 처음으로 (Return) |
| `toggle_metronome` | 메트로놈 켜기/끄기 (K) |
| `toggle_cycle` | 사이클(반복) 구간 토글 (C) |

### 편집
| 도구 | 설명 |
|---|---|
| `new_track` | 새로운 트랙 대화상자 열기 (Cmd+Opt+N) |
| `undo` / `redo` | 실행 취소 / 복귀 |

### 범용 UI 조작 (위 도구로 안 되는 모든 것)
| 도구 | 설명 |
|---|---|
| `list_menus` | 메뉴/메뉴 항목 이름 조회 — 시스템 언어(한국어/영어)에 따른 정확한 이름 확인용 |
| `click_menu` | 메뉴 경로로 항목 클릭. 예: `["공유", "디스크로 노래 내보내기…"]` |
| `press_key` | 키 입력 (return, escape, 화살표 등 + modifier) — 대화상자 조작용 |
| `type_text` | 포커스된 입력란에 텍스트 타이핑 — 파일 이름 입력용 |
| `click_button` | 대화상자/시트의 버튼을 이름으로 클릭 |
| `export_song` | 곡 내보내기 대화상자 열기 (공유 > 디스크로 노래 내보내기…) |
| `run_applescript` | 임의의 AppleScript 실행 (고급 — 최후의 수단) |

## 동작 원리와 한계

- **UI 스크립팅 기반**: 모든 조작은 실제 화면의 GarageBand에 키 입력/메뉴 클릭을 보내는
  방식입니다. 도구 실행 시 GarageBand가 자동으로 앞쪽으로 활성화됩니다.
- **메뉴 이름은 시스템 언어를 따릅니다**: macOS가 한국어면 `["공유", "디스크로 노래 내보내기…"]`,
  영어면 `["Share", "Export Song to Disk…"]`. 정확한 이름은 `list_menus`로 확인하세요.
  말줄임표는 `...`(마침표 3개)가 아니라 `…`(U+2026) 한 글자입니다.
- **대화상자 흐름**: 내보내기·저장 등 대화상자가 뜨는 작업은
  `export_song` → `type_text`(파일명) → `click_button`("내보내기") 처럼 여러 도구를 조합합니다.
- **할 수 없는 것**: GarageBand는 프로그래밍 API가 없어 개별 노트 편집, 정밀한 미디 입력,
  플러그인 파라미터 제어 같은 세밀한 작업은 어렵습니다. 이런 작업이 필요하면 Logic Pro
  (AppleScript 지원)를 고려하세요.

## 문제 해결

| 증상 | 해결 |
|---|---|
| "손쉬운 사용 권한이 없습니다" 오류 | 위의 권한 설정 참고. 터미널 앱을 권한 목록에 추가 후 **터미널 재시작** |
| 메뉴 클릭 실패 (`Can't get menu item ...`) | `list_menus`로 실제 메뉴 이름 확인 — 언어/버전에 따라 다름 |
| 키 입력이 다른 앱으로 감 | 도구가 자동으로 GarageBand를 활성화하지만, 실행 직후라면 잠시 기다렸다 재시도 |
| 도구가 응답 없음 | GarageBand에 모달 대화상자가 떠 있는지 확인 — `press_key`(escape)로 닫기 |
