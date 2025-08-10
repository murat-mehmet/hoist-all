// hoist-all.js
const fs = require('fs');
const path = require('path');

// Known folders to skip in node_modules (applied only at node_modules top-level and scope children)
const SKIP_FOLDERS = new Set([
  '.bin',
  '.cache',
  '.store',
  '_npx',
  '_cacache',
  'hoist-all'
]);

function createSymlink(src, dest, entry, { config, modConfig }) {
  if (fs.existsSync(dest)) {
    // skip existing
    return false;
  }

  let stat = fs.lstatSync(src);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // If src is a symlink, replicate the symlink (preserve link target).
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(src);
      // Ensure parent exists
      try {
        const type = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(target, dest, type);
      } catch (err) {
        console.log('err',err)
        // On Windows or if symlink creation fails, fallback to copying target content
        const real = fs.existsSync(src) ? fs.realpathSync(src) : null;
        if (real && fs.existsSync(real) && fs.lstatSync(real).isDirectory()) {
          copyDirRecursive(real, dest, modConfig);
        } else if (real && fs.existsSync(real)) {
          fs.copyFileSync(real, dest);
        } else {
          // give up silently
        }
      }
      return;
    }
    else if (stat.isDirectory()) {
      const type = process.platform === 'win32' ? 'junction' : 'dir';
      if (config.reverseSymlink){
        fs.renameSync(src, dest);
        // On Windows, use junction for directories
        fs.symlinkSync(dest, src, type);
      } else {
        fs.symlinkSync(src, dest, type);
      }
    } else {
      // file or symlink to file
      if (config.reverseSymlink){
        fs.renameSync(src, dest);
        fs.symlinkSync(dest, src, 'file');
      } else {
        fs.symlinkSync(src, dest, 'file');
      }
    }
    return true;
  } catch (err) {
    console.log('err',err)
    // fallback: if symlink fails, just copy
    if (stat.isDirectory()) {
      copyDirRecursive(src, dest, { config, modConfig });
    } else {
      fs.copyFileSync(src, dest);
    }
    return true;
  }
}

/**
 * Recursively copy src -> dest preserving files, directories and symlinks.
 * NO skip checks here; this is a deep copy for a single module's contents.
 */
function copyDirRecursive(src, dest, { config, modConfig }) {
  const stat = fs.lstatSync(src);

  // If src is a symlink, replicate the symlink (preserve link target).
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(src);
    // Ensure parent exists
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.symlinkSync(target, dest);
    } catch (err) {
      // On Windows or if symlink creation fails, fallback to copying target content
      const real = fs.existsSync(src) ? fs.realpathSync(src) : null;
      if (real && fs.existsSync(real) && fs.lstatSync(real).isDirectory()) {
        copyDirRecursive(real, dest, { config, modConfig });
      } else if (real && fs.existsSync(real)) {
        fs.copyFileSync(real, dest);
      } else {
        // give up silently
      }
    }
    return;
  }

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const children = fs.readdirSync(src);
    for (const child of children) {
      const srcChild = path.join(src, child);
      const destChild = path.join(dest, child);
      copyDirRecursive(srcChild, destChild, { config, modConfig });
    }
    return;
  }

  // file
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
// Helper: Simple progress bar in console, overwrite current line
const disableProgress = false;
function showProgressBar(current, total, moduleName = '') {
  if (disableProgress) return;
  const width = 30; // progress bar width in chars
  const ratio = current / total;
  const completed = Math.floor(ratio * width);
  const left = width - completed;
  const bar = '█'.repeat(completed) + ' '.repeat(left);
  const percent = (ratio * 100).toFixed(1);
  const message = `\r[${bar}] ${percent}% (${current}/${total}) ${moduleName}`.substring(0, process.stdout.columns);
  process.stdout.write(`${message}${' '.repeat(process.stdout.columns - message.length)}`)
}

/**
 * Copy top-level modules from srcNodeModules -> destNodeModules.
 * - Only apply skip checks at node_modules top level (and for scoped directory children).
 * - Count modules copied (1 per package; scoped children counted individually).
 *
 * @param {string} srcNodeModules
 * @param {string} destNodeModules
 * @param {Set<string>} skipNames - names to skip (e.g. app names)
 * @returns {number} number of modules copied
 */
function copyModulesTopLevel(srcNodeModules, destNodeModules, skipNames = new Set(), config = {}) {
  if (!fs.existsSync(srcNodeModules)) return 0;
  fs.mkdirSync(destNodeModules, { recursive: true });

  const entries = fs.readdirSync(srcNodeModules);
  // First gather modules to copy (filtered)
  let modulesToCopy = [];

  for (const entry of entries) {
    if (entry.startsWith('.') || SKIP_FOLDERS.has(entry) || skipNames.has(entry)) {
      continue;
    }

    const srcEntryPath = path.join(srcNodeModules, entry);
    let entryStat;
    try {
      entryStat = fs.lstatSync(srcEntryPath);
    } catch (err) {
      continue;
    }

    if (entry.startsWith('@') && entryStat.isDirectory()) {
      const scopedChildren = fs.readdirSync(srcEntryPath);
      for (const child of scopedChildren) {
        if (child.startsWith('.') || SKIP_FOLDERS.has(child) || skipNames.has(child) || skipNames.has(`${entry}/${child}`)) {
          continue;
        }
        const srcPkgPath = path.join(srcEntryPath, child);
        let childStat;
        try {
          childStat = fs.lstatSync(srcPkgPath);
        } catch (err) {
          continue;
        }
        if (!childStat.isDirectory() && !childStat.isSymbolicLink()) continue;

        modulesToCopy.push({ src: srcPkgPath, dest: path.join(destNodeModules, entry, child), name: `${entry}/${child}` });
      }
    } else {
      if (!entryStat.isDirectory() && !entryStat.isSymbolicLink()) {
        continue;
      }
      modulesToCopy.push({ src: srcEntryPath, dest: path.join(destNodeModules, entry), name: entry });
    }
  }

  let moduleCount = 0;
  let copied = 0;
  const total = modulesToCopy.length;

  for (const mod of modulesToCopy) {

    let modConfig = {};
    if (config?.packages) {
      const entries = Object.entries(config.packages);
      for (const [regexp, _modConfig] of entries) {
        if (new RegExp(regexp).test(mod.name)) {
          modConfig = _modConfig;
        }
      }
    }
    if (fs.existsSync(mod.dest)) {
      if (modConfig.overwrite){
        fs.rmSync(mod.dest, { recursive: true });
      } else {
        // skip existing
        moduleCount++;
        showProgressBar(moduleCount, total, mod.name);
        continue;
      }
    }

    const task = modConfig.task ?? "symlink";
    if (task === "symlink")
      createSymlink(mod.src, mod.dest, mod.entry, { config, modConfig });
    else if (task === "copy")
      copyDirRecursive(mod.src, mod.dest, { config, modConfig });
    moduleCount++;
    copied++;
    showProgressBar(moduleCount, total, mod.name);
  }

  return copied;
}

/**
 * Read hoist config for an app (currently from package.json -> hoist).
 * @param {string} appPath
 * @returns {object|null}
 */
function getHoistConfig(appPath) {
  const pkgPath = path.join(appPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.hoist || null;
  } catch (err) {
    // don't crash; return null
    return null;
  }
}

/**
 * Main entry: hoist or reverse-hoist modules per app config.
 * @param {string} [workspaceRoot=process.cwd()]
 * @param {string} [appsFolder='apps']
 */
function hoistAll(workspaceRoot = process.cwd(), appsFolder = 'apps') {
  const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');
  const appsDir = path.resolve(workspaceRoot, appsFolder);

  // ensure root node_modules exists (for reverse hoist or normal hoist destination)
  if (!fs.existsSync(rootNodeModules)) {
    fs.mkdirSync(rootNodeModules, { recursive: true });
  }

  if (!fs.existsSync(appsDir)) {
    console.error(`No "${appsFolder}" folder found at ${appsDir}`);
    process.exit(1);
  }

  // gather app names (to skip workspace symlinks)
  const apps = fs.readdirSync(appsDir).filter(name =>
    fs.existsSync(path.join(appsDir, name)) && fs.statSync(path.join(appsDir, name)).isDirectory()
  );
  const skipNames = new Set(apps);

  for (const app of apps) {
    const appPath = path.join(appsDir, app);
    const config = getHoistConfig(appPath);
    const appNodeModules = path.join(appPath, 'node_modules');

    if (config && config.target === 'app') {
      // Reverse hoist: copy modules from root -> app
      fs.mkdirSync(appNodeModules, { recursive: true });
      const copied = copyModulesTopLevel(rootNodeModules, appNodeModules, skipNames, config);
      const message = `\r${app}: reverse-hoisted ${copied} modules`;
      if (disableProgress)
        console.log(message.substring(1));
      else
        console.log(`${message}${' '.repeat(process.stdout.columns - message.length)}`);
    } else {
      // Normal hoist: copy modules from app -> root
      if (!fs.existsSync(appNodeModules)) {
        // nothing to hoist for this app
        continue;
      }
      const copied = copyModulesTopLevel(appNodeModules, rootNodeModules, skipNames, config);
      const message = `\r${app}: hoisted ${copied} modules`.substring(0, process.stdout.columns);

      if (disableProgress)
        console.log(message.substring(1));
      else
        console.log(`${message}${' '.repeat(process.stdout.columns - message.length)}`);
    }
  }

  console.log('Done hoisting.');
}

module.exports = hoistAll;
