// Preloaded into the Firebase CLI (NODE_OPTIONS=--require) by start.ps1.
// The CLI starts the Java emulators with spawn({ detached: true }). On Windows that
// gives the child its own NEW console window, which pops up on the user's screen.
// We don't need detached children (stop.ps1 kills them), so drop the flag and hide
// any window: the child then shares our invisible console.
if (process.platform === 'win32') {
  const cp = require('node:child_process');
  const wrap = (fn) => function (file, args, options) {
    let o = Array.isArray(args) ? options : args;
    if (o && typeof o === 'object') { o.detached = false; o.windowsHide = true; }
    return fn.apply(this, arguments);
  };
  cp.spawn = wrap(cp.spawn);
  cp.execFile = wrap(cp.execFile);
}
