const fs = require("fs");
const path = require("path");

// Known folders to skip in node_modules
const SKIP_FOLDERS = new Set([
  ".bin",
  ".cache",
  ".store",
  "_npx",
  "_cacache"
]);

/**
 * Recursively copies a folder's contents to destination, counting copied files.
 * Skips hidden/system folders and already existing items in dest.
 */
function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;

  let copiedCount = 0;
  const items = fs.readdirSync(src);

  for (const item of items) {
    // Skip all hidden folders and known system folders
    if (item.startsWith(".") || SKIP_FOLDERS.has(item)) {
      continue;
    }

    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.existsSync(destPath)) {
      continue; // skip silently
    }

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copiedCount += copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * Copies node_modules from each app into root node_modules.
 * @param {string} [workspaceRoot=process.cwd()] - Path to monorepo root.
 * @param {string} [appsFolder="apps"] - Name of folder containing apps.
 */
function copyAppNodeModules(workspaceRoot = process.cwd(), appsFolder = "apps") {
  const rootNodeModules = path.resolve(workspaceRoot, "node_modules");
  const appsDir = path.resolve(workspaceRoot, appsFolder);

  if (!fs.existsSync(rootNodeModules)) {
    fs.mkdirSync(rootNodeModules);
  }

  if (!fs.existsSync(appsDir)) {
    console.error(`No "${appsFolder}" folder found at ${appsDir}`);
    process.exit(1);
  }

  const apps = fs.readdirSync(appsDir);
  for (const app of apps) {
    const appNodeModules = path.join(appsDir, app, "node_modules");
    if (!fs.existsSync(appNodeModules)) continue;

    const copied = copyFolderRecursive(appNodeModules, rootNodeModules);
    console.log(`${app}: hoisted ${copied} modules`);
  }

  console.log("Done hoisting.");
}

module.exports = copyAppNodeModules;

