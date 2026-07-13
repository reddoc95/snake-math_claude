#!/usr/bin/env node
/**
 * garageband-mcp — Claude Code에서 Apple GarageBand를 제어하는 MCP 서버
 *
 * GarageBand는 공식 AppleScript 사전(dictionary)이 거의 없기 때문에,
 * macOS System Events UI 스크립팅(메뉴 클릭 + 키보드 단축키)으로 제어한다.
 * 따라서 이 서버는 macOS에서만 동작하며, Claude Code를 실행하는 터미널 앱에
 * 손쉬운 사용(Accessibility) 권한이 필요하다.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const APP = "GarageBand";

// ---------------------------------------------------------------------------
// AppleScript helpers
// ---------------------------------------------------------------------------

function asString(s) {
  // AppleScript 문자열 리터럴 이스케이프
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function runAppleScript(script) {
  if (process.platform !== "darwin") {
    throw new Error("이 서버는 macOS에서만 동작합니다 (osascript 필요).");
  }
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 30_000,
    });
    return stdout.trim();
  } catch (err) {
    const stderr = (err.stderr || err.message || "").trim();
    if (/not allowed assistive access|1002|osascript is not allowed/i.test(stderr)) {
      throw new Error(
        "손쉬운 사용(Accessibility) 권한이 없습니다. " +
          "시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용에서 " +
          "Claude Code를 실행 중인 터미널 앱(Terminal/iTerm 등)을 허용하세요.\n" +
          stderr
      );
    }
    throw new Error(`osascript 오류: ${stderr}`);
  }
}

/** GarageBand를 앞으로 가져온 뒤 System Events 블록을 실행 */
function withFrontmost(body) {
  return `
tell application ${asString(APP)} to activate
delay 0.4
tell application "System Events"
  tell process ${asString(APP)}
${body}
  end tell
end tell`.trim();
}

/** 메뉴 경로(["트랙", "새로운 트랙…"] 등)를 System Events 참조로 변환 */
function menuItemRef(path) {
  let ref = `menu 1 of menu bar item ${asString(path[0])} of menu bar 1`;
  for (let i = 1; i < path.length - 1; i++) {
    ref = `menu 1 of menu item ${asString(path[i])} of ${ref}`;
  }
  return `menu item ${asString(path[path.length - 1])} of ${ref}`;
}

async function clickMenuPath(path) {
  if (path.length < 2) {
    throw new Error("메뉴 경로는 최소 2단계여야 합니다. 예: [\"File\", \"Save\"]");
  }
  await runAppleScript(withFrontmost(`    click ${menuItemRef(path)}`));
}

// 특수 키 이름 → macOS key code
const KEY_CODES = {
  return: 36, enter: 36, tab: 48, space: 49, delete: 51, escape: 53,
  left: 123, right: 124, down: 125, up: 126,
  home: 115, end: 119, pageup: 116, pagedown: 121,
};

function modifiersClause(modifiers) {
  if (!modifiers || modifiers.length === 0) return "";
  const map = { command: "command down", option: "option down", shift: "shift down", control: "control down" };
  return ` using {${modifiers.map((m) => map[m]).join(", ")}}`;
}

async function sendKey(key, modifiers) {
  const mods = modifiersClause(modifiers);
  const lower = key.toLowerCase();
  const body =
    lower in KEY_CODES
      ? `    key code ${KEY_CODES[lower]}${mods}`
      : `    keystroke ${asString(key)}${mods}`;
  await runAppleScript(withFrontmost(body));
}

function ok(text) {
  return { content: [{ type: "text", text }] };
}

function fail(err) {
  return { content: [{ type: "text", text: String(err.message || err) }], isError: true };
}

async function tryRun(fn, successMessage) {
  try {
    const result = await fn();
    return ok(typeof result === "string" && result ? result : successMessage);
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// MCP server & tools
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "garageband", version: "1.0.0" });

server.registerTool(
  "garageband_status",
  {
    title: "GarageBand 상태 확인",
    description:
      "GarageBand 실행 여부, 앞쪽 윈도우(열린 프로젝트) 이름, UI 스크립팅(손쉬운 사용) 권한 상태를 반환한다. 다른 도구를 쓰기 전에 먼저 호출하면 좋다.",
    inputSchema: {},
  },
  async () =>
    tryRun(async () => {
      const script = `
set uiEnabled to "unknown"
try
  tell application "System Events" to set uiEnabled to (UI elements enabled) as text
end try
set isRunning to false
tell application "System Events" to set isRunning to (exists process ${asString(APP)})
set frontWindow to ""
if isRunning then
  try
    tell application "System Events" to tell process ${asString(APP)}
      set frontWindow to name of front window
    end tell
  end try
end if
return "running=" & (isRunning as text) & "; frontWindow=" & frontWindow & "; accessibilityEnabled=" & uiEnabled`.trim();
      return await runAppleScript(script);
    }, "")
);

server.registerTool(
  "launch_garageband",
  {
    title: "GarageBand 실행",
    description: "GarageBand를 실행하고 앞으로 가져온다. 처음 실행이면 프로젝트 선택 화면이 뜬다.",
    inputSchema: {},
  },
  async () =>
    tryRun(
      () => runAppleScript(`tell application ${asString(APP)} to activate`),
      "GarageBand를 실행했습니다."
    )
);

server.registerTool(
  "quit_garageband",
  {
    title: "GarageBand 종료",
    description:
      "GarageBand를 종료한다. 저장하지 않은 변경 사항이 있으면 저장 대화상자가 뜰 수 있다 (press_key로 응답 가능).",
    inputSchema: {},
  },
  async () =>
    tryRun(
      () => runAppleScript(`tell application ${asString(APP)} to quit`),
      "GarageBand 종료를 요청했습니다."
    )
);

server.registerTool(
  "open_project",
  {
    title: "프로젝트 열기",
    description: "지정한 경로의 GarageBand 프로젝트(.band)나 오디오/MIDI 파일을 GarageBand로 연다.",
    inputSchema: {
      path: z.string().describe("열 파일의 절대 경로. 예: /Users/me/Music/song.band"),
    },
  },
  async ({ path }) =>
    tryRun(async () => {
      await execFileAsync("open", ["-a", APP, path], { timeout: 15_000 });
      return `열기 요청: ${path}`;
    }, "")
);

server.registerTool(
  "play_pause",
  {
    title: "재생/정지 토글",
    description: "스페이스바를 눌러 재생을 시작하거나 정지한다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("space"), "재생/정지를 토글했습니다.")
);

server.registerTool(
  "toggle_record",
  {
    title: "녹음 시작/중지",
    description: "R 키를 눌러 녹음을 시작하거나 중지한다. 녹음은 현재 선택된 트랙에 이루어진다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("r"), "녹음을 토글했습니다.")
);

server.registerTool(
  "go_to_beginning",
  {
    title: "처음으로 이동",
    description: "재생 헤드를 곡의 처음으로 이동한다 (Return 키).",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("return"), "재생 헤드를 처음으로 이동했습니다.")
);

server.registerTool(
  "toggle_metronome",
  {
    title: "메트로놈 토글",
    description: "K 키를 눌러 메트로놈을 켜거나 끈다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("k"), "메트로놈을 토글했습니다.")
);

server.registerTool(
  "toggle_cycle",
  {
    title: "사이클(반복) 구간 토글",
    description: "C 키를 눌러 사이클 구간을 켜거나 끈다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("c"), "사이클 구간을 토글했습니다.")
);

server.registerTool(
  "save_project",
  {
    title: "프로젝트 저장",
    description:
      "Cmd+S로 현재 프로젝트를 저장한다. 새 프로젝트라면 저장 대화상자가 뜨므로 type_text와 press_key로 이름을 입력하고 Return을 누르면 된다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("s", ["command"]), "저장(Cmd+S)을 실행했습니다.")
);

server.registerTool(
  "undo",
  {
    title: "실행 취소",
    description: "Cmd+Z로 마지막 동작을 취소한다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("z", ["command"]), "실행 취소(Cmd+Z)를 실행했습니다.")
);

server.registerTool(
  "redo",
  {
    title: "실행 복귀",
    description: "Cmd+Shift+Z로 취소한 동작을 다시 실행한다.",
    inputSchema: {},
  },
  async () => tryRun(() => sendKey("z", ["command", "shift"]), "실행 복귀(Cmd+Shift+Z)를 실행했습니다.")
);

server.registerTool(
  "new_track",
  {
    title: "새 트랙 대화상자 열기",
    description:
      "Cmd+Opt+N으로 '새로운 트랙' 대화상자를 연다. 이후 press_key(left/right 화살표)로 트랙 종류(소프트웨어 악기/오디오/드러머)를 선택하고 press_key(return)로 생성한다.",
    inputSchema: {},
  },
  async () =>
    tryRun(
      () => sendKey("n", ["command", "option"]),
      "새로운 트랙 대화상자를 열었습니다. press_key로 종류를 선택한 뒤 return을 누르세요."
    )
);

server.registerTool(
  "list_menus",
  {
    title: "메뉴 항목 조회",
    description:
      "GarageBand 메뉴 막대의 메뉴 이름들, 또는 특정 메뉴 안의 항목 이름들을 조회한다. 시스템 언어에 따라 메뉴 이름이 다르므로(한국어/영어), click_menu를 쓰기 전에 정확한 이름을 확인할 때 사용한다.",
    inputSchema: {
      menu: z
        .string()
        .optional()
        .describe("항목을 조회할 상위 메뉴 이름 (예: '파일' 또는 'File'). 생략하면 최상위 메뉴 목록을 반환."),
    },
  },
  async ({ menu }) =>
    tryRun(async () => {
      const body = menu
        ? `    return name of every menu item of menu 1 of menu bar item ${asString(menu)} of menu bar 1`
        : `    return name of every menu bar item of menu bar 1`;
      return await runAppleScript(withFrontmost(body));
    }, "")
);

server.registerTool(
  "click_menu",
  {
    title: "메뉴 항목 클릭",
    description:
      "GarageBand 메뉴 막대의 항목을 경로로 클릭한다. 예: ['공유', '디스크로 노래 내보내기…'] 또는 ['Track', 'Show Drummer Editor']. 하위 메뉴도 지원 (3단계 이상 경로). 정확한 이름은 list_menus로 확인. '…'(말줄임표, U+2026)가 붙는 항목에 주의.",
    inputSchema: {
      path: z.array(z.string()).min(2).describe("메뉴 경로 배열. 첫 요소는 메뉴 막대 이름."),
    },
  },
  async ({ path }) => tryRun(() => clickMenuPath(path), `메뉴 클릭: ${path.join(" > ")}`)
);

server.registerTool(
  "press_key",
  {
    title: "키 입력",
    description:
      "GarageBand에 키 입력을 보낸다. 특수 키 이름(return, escape, space, tab, delete, up/down/left/right 등) 또는 단일 문자를 지원하며 modifier(command/option/shift/control)를 함께 쓸 수 있다. 대화상자 조작에 유용.",
    inputSchema: {
      key: z.string().describe("키 이름 또는 단일 문자. 예: 'return', 'escape', 's'"),
      modifiers: z
        .array(z.enum(["command", "option", "shift", "control"]))
        .optional()
        .describe("함께 누를 modifier 키"),
    },
  },
  async ({ key, modifiers }) =>
    tryRun(() => sendKey(key, modifiers), `키 입력: ${(modifiers || []).join("+")}${modifiers?.length ? "+" : ""}${key}`)
);

server.registerTool(
  "type_text",
  {
    title: "텍스트 입력",
    description: "GarageBand의 현재 포커스된 입력란에 텍스트를 타이핑한다. 저장/내보내기 대화상자에서 파일 이름 입력에 사용.",
    inputSchema: {
      text: z.string().describe("입력할 텍스트"),
    },
  },
  async ({ text }) =>
    tryRun(
      () => runAppleScript(withFrontmost(`    keystroke ${asString(text)}`)),
      `텍스트 입력: ${text}`
    )
);

server.registerTool(
  "click_button",
  {
    title: "대화상자 버튼 클릭",
    description:
      "현재 앞쪽 윈도우 또는 시트(sheet)의 버튼을 이름으로 클릭한다. 내보내기/저장 대화상자의 '내보내기', 'Export', '저장' 버튼 등에 사용.",
    inputSchema: {
      name: z.string().describe("버튼 이름. 예: '내보내기', 'Export', 'Save'"),
    },
  },
  async ({ name }) =>
    tryRun(async () => {
      const body = `
    try
      click button ${asString(name)} of sheet 1 of front window
    on error
      click button ${asString(name)} of front window
    end try`;
      await runAppleScript(withFrontmost(body));
    }, `버튼 클릭: ${name}`)
);

server.registerTool(
  "export_song",
  {
    title: "곡 내보내기 대화상자 열기",
    description:
      "'공유 > 디스크로 노래 내보내기…' (Share > Export Song to Disk…) 메뉴를 열어 내보내기 대화상자를 띄운다. 이후 type_text로 파일 이름을, press_key/click_button으로 포맷 선택과 내보내기 버튼을 조작한다. 메뉴 이름이 다르면 list_menus로 확인 후 click_menu를 직접 사용.",
    inputSchema: {},
  },
  async () =>
    tryRun(async () => {
      const candidates = [
        ["공유", "디스크로 노래 내보내기…"],
        ["Share", "Export Song to Disk…"],
      ];
      let lastErr;
      for (const path of candidates) {
        try {
          await clickMenuPath(path);
          return `내보내기 대화상자를 열었습니다 (${path.join(" > ")}).`;
        } catch (err) {
          lastErr = err;
        }
      }
      throw new Error(
        `내보내기 메뉴를 찾지 못했습니다. list_menus로 정확한 메뉴 이름을 확인한 뒤 click_menu를 사용하세요. 마지막 오류: ${lastErr?.message}`
      );
    }, "")
);

server.registerTool(
  "run_applescript",
  {
    title: "AppleScript 직접 실행 (고급)",
    description:
      "임의의 AppleScript를 실행하는 만능 도구. 위 도구들로 안 되는 세밀한 UI 조작(슬라이더, 체크박스, 특정 UI 요소 탐색 등)에 사용한다. System Events로 GarageBand 프로세스를 조작하는 스크립트를 작성하면 된다.",
    inputSchema: {
      script: z.string().describe("실행할 AppleScript 소스 코드"),
    },
  },
  async ({ script }) =>
    tryRun(async () => {
      const result = await runAppleScript(script);
      return result || "실행 완료 (출력 없음)";
    }, "")
);

// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("garageband-mcp server running on stdio");
