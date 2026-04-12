const { spawn } = require('child_process');

function getOpenCommand(url) {
  switch (process.platform) {
    case 'win32':
      // `start` is a cmd builtin, so we launch it through cmd and provide an
      // empty window title to avoid quoting edge cases with URLs.
      return {
        command: 'cmd',
        args: ['/c', 'start', '""', url]
      };
    case 'darwin':
      return {
        command: 'open',
        args: [url]
      };
    default:
      return {
        command: 'xdg-open',
        args: [url]
      };
  }
}

module.exports.openInBrowser = (url) => new Promise((resolve, reject) => {
  const { command, args } = getOpenCommand(url);
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });

  child.once('error', reject);
  child.once('spawn', () => {
    child.unref();
    resolve();
  });
});
