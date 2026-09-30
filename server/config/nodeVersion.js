// Imported first by server/index.js. better-sqlite3 crashes the process
// (segfault, no error message) on older Node versions, so fail clearly first.
const REQUIRED_MAJOR = 24;
const currentMajor = Number(process.versions.node.split('.')[0]);

if (currentMajor < REQUIRED_MAJOR) {
  console.error(
    `CarbonCTRL requires Node.js ${REQUIRED_MAJOR} or newer; this is ${process.version}. ` +
    'Run `nvm use` in the project root (see .nvmrc).'
  );
  process.exit(1);
}
