#!/usr/bin/env node
// Drive the app on the headless emulator over adb. No window, no focus changes.
//
//   node test-env/drive.mjs launch              start (or restart) the app
//   node test-env/drive.mjs reload              reload JS from Metro (after code changes)
//   node test-env/drive.mjs shot [name]         screenshot -> E:/HabitScapeTestEnv/shots/<name>.png
//   node test-env/drive.mjs ui                  list visible text / labels with tap points
//   node test-env/drive.mjs tap "<text>"        tap the element whose text or label contains <text>
//   node test-env/drive.mjs tapxy <x> <y>       tap a coordinate
//   node test-env/drive.mjs type "<text>"       type into the focused field
//   node test-env/drive.mjs key <back|enter|tab>
//   node test-env/drive.mjs wait "<text>" [sec] wait until <text> is on screen (returns at once
//                                               on animated screens like login: then use `shot`)
//   node test-env/drive.mjs swipe <up|down>
//   node test-env/drive.mjs logs                recent React Native errors from logcat
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PKG = 'com.buckorogers.habitscape';
const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const ADB = existsSync(join(sdk, 'platform-tools', 'adb.exe')) ? join(sdk, 'platform-tools', 'adb.exe') : 'adb';

const serial = execFileSync(ADB, ['devices'], { encoding: 'utf8' })
  .split('\n').map(l => l.trim()).find(l => /^emulator-\d+\s+device$/.test(l))?.split(/\s+/)[0];
if (!serial) { console.error('No emulator running. Run test-env/start.ps1 first.'); process.exit(2); }

const adb = (args, opts = {}) => execFileSync(ADB, ['-s', serial, ...args], { maxBuffer: 64 << 20, ...opts });
const sh = (cmd) => adb(['shell', cmd], { encoding: 'utf8' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let quietUnreadable = false;
const appInFront = () => sh('dumpsys activity activities 2>/dev/null | grep -m1 -E "topResumedActivity|mResumedActivity"').includes(PKG);

function nodes() {
  // uiautomator can't dump while the screen animates nonstop (e.g. the login
  // screen's stars and torches): it reports "could not get idle state". Then use
  // `shot` and `tapxy` (screenshot pixels map 1:1 to tap coordinates).
  const res = sh('uiautomator dump /sdcard/ui.xml 2>&1');
  if (/idle state|ERROR/i.test(res)) {
    if (!quietUnreadable) console.error('UI tree unavailable (screen never idle). Use `shot` + `tapxy` here.');
    return null;
  }
  const xml = sh('cat /sdcard/ui.xml');
  const out = [];
  for (const m of xml.matchAll(/<node [^>]*>/g)) {
    const attr = (n) => (m[0].match(new RegExp(` ${n}="([^"]*)"`)) || [])[1] ?? '';
    const label = (attr('text') || attr('content-desc')).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, ' ');
    const b = attr('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!label || !b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    out.push({ label, x: (x1 + x2) >> 1, y: (y1 + y2) >> 1, clickable: attr('clickable') === 'true', focused: attr('focused') === 'true' });
  }
  return out;
}

function find(text, all = nodes()) {
  const t = text.toLowerCase();
  if (!all) return null;
  return all.find(n => n.label.toLowerCase() === t) ?? all.find(n => n.label.toLowerCase().includes(t));
}

async function waitFor(text, sec = 20) {
  const end = Date.now() + sec * 1000;
  // An animated screen (login, sign-up) can never be read, so waiting for its text
  // would just burn the whole timeout. If the app is in front but unreadable, stop
  // right away and say so: the screen is up, check it with `shot`.
  quietUnreadable = true;
  while (Date.now() < end) {
    const all = nodes();
    if (all === null && appInFront()) {
      console.log(`app is up, but its screen is animating so "${text}" can't be checked; use \`shot\``);
      process.exit(0);
    }
    const n = all && find(text, all);
    if (n) return n;
    await sleep(700);
  }
  throw new Error(`"${text}" not on screen after ${sec}s`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'launch':
    sh(`am force-stop ${PKG}`);
    // am start brings the app to the front even right after a cold boot (monkey sometimes didn't).
    sh(`am start -n ${PKG}/.MainActivity >/dev/null 2>&1`);
    console.log('launched');
    break;
  case 'reload':
    // Metro tells every connected app to reload; no device input needed.
    await fetch('http://127.0.0.1:8081/reload', { method: 'POST' });
    console.log('reload sent');
    break;
  case 'shot': {
    const home = process.env.HS_TEST_HOME || (existsSync('E:\\') ? 'E:\\HabitScapeTestEnv' : here);
    const dir = join(home, home === here ? '.shots' : 'shots');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${args[0] || new Date().toISOString().replace(/[:.]/g, '-')}.png`);
    writeFileSync(file, adb(['exec-out', 'screencap', '-p']));
    console.log(file);
    break;
  }
  case 'ui':
    for (const n of nodes() ?? []) console.log(`${n.clickable ? '*' : ' '}${n.focused ? '>' : ' '} (${n.x},${n.y}) ${n.label}`);
    break;
  case 'tap': {
    const n = await waitFor(args.join(' '), 10);
    sh(`input tap ${n.x} ${n.y}`);
    console.log(`tapped "${n.label}" at (${n.x},${n.y})`);
    break;
  }
  case 'tapxy':
    sh(`input tap ${Number(args[0])} ${Number(args[1])}`);
    break;
  case 'type': {
    // adb input text: spaces as %s, shell metacharacters escaped.
    const t = args.join(' ').replace(/([\\'"`$&|;<>()*?!#~])/g, '\\$1').replace(/ /g, '%s');
    sh(`input text ${t}`);
    break;
  }
  case 'key': {
    const codes = { back: 4, enter: 66, tab: 61, del: 67 };
    sh(`input keyevent ${codes[args[0]] ?? args[0]}`);
    break;
  }
  case 'wait': {
    const n = await waitFor(args[0], Number(args[1] ?? 20));
    console.log(`found "${n.label}"`);
    break;
  }
  case 'swipe':
    sh(args[0] === 'up' ? 'input swipe 540 1700 540 700 300' : 'input swipe 540 700 540 1700 300');
    break;
  case 'logs':
    console.log(sh('logcat -d -t 400 ReactNativeJS:V ReactNative:E AndroidRuntime:E *:S'));
    break;
  default:
    console.log('Commands: launch, reload, shot, ui, tap, tapxy, type, key, wait, swipe, logs');
}
