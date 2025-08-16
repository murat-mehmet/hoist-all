const fs = require('fs');
const path = require('path');

const HOIST_DIR = '.hoist-all';
const STATE_FILE = 'state.json';

function getHoistRoot(workspaceRoot) {
  return path.join(workspaceRoot, HOIST_DIR);
}

function getStatePath(workspaceRoot) {
  return path.join(getHoistRoot(workspaceRoot), STATE_FILE);
}

function readState(workspaceRoot) {
  const statePath = getStatePath(workspaceRoot);
  if (!fs.existsSync(statePath)) return { active_scope: null, scopes: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { active_scope: null, scopes: {} };
  }
}

function writeState(workspaceRoot, state) {
  const hoistRoot = getHoistRoot(workspaceRoot);
  fs.mkdirSync(hoistRoot, { recursive: true });
  fs.writeFileSync(getStatePath(workspaceRoot), JSON.stringify(state, null, 2));
}

function getMatchingDirs(workspaceRoot, folderName, regex) {
  if (!regex) return [];
  const folderRoot = path.join(workspaceRoot, folderName);
  if (!fs.existsSync(folderRoot)) return [];
  const re = new RegExp(regex);
  return fs.readdirSync(folderRoot)
    .filter(f => fs.statSync(path.join(folderRoot, f)).isDirectory())
    .filter(f => re.test(f));
}

function saveScopedDeps(workspaceRoot, scopeDir, folderName, regex) {
  const matches = getMatchingDirs(workspaceRoot, folderName, regex);
  for (const dir of matches) {
    const nm = path.join(workspaceRoot, folderName, dir, 'node_modules');
    const scopedNm = path.join(scopeDir, folderName, dir, 'node_modules');
    fs.mkdirSync(path.dirname(scopedNm), { recursive: true });
    if (fs.existsSync(scopedNm)) fs.rmSync(scopedNm, { recursive: true, force: true });
    if (fs.existsSync(nm)) {
      fs.renameSync(nm, scopedNm);
      console.log(`Saved ${folderName} "${dir}" node_modules into scope.`);
    }
  }
}

function restoreScopedDeps(workspaceRoot, scopeName, folderName, oldRegex, newRegex, state) {
  const hoistRoot = getHoistRoot(workspaceRoot);
  const oldScopeDir = path.join(hoistRoot, state.active_scope || '');
  const newScopeDir = path.join(hoistRoot, scopeName);

  if (oldRegex) {
    const oldMatches = getMatchingDirs(workspaceRoot, folderName, oldRegex);

    for (const dir of oldMatches) {
      const nm = path.join(workspaceRoot, folderName, dir, 'node_modules');
      const oldScoped = path.join(oldScopeDir, folderName, dir, 'node_modules');

      if (fs.existsSync(nm) && state.active_scope) {
        if (fs.existsSync(oldScoped)) fs.rmSync(oldScoped, { recursive: true, force: true });
        fs.renameSync(nm, oldScoped);
      }
    }
  }

  if (newRegex) {
    const newMatches = getMatchingDirs(workspaceRoot, folderName, newRegex);
    for (const dir of newMatches) {
      const nm = path.join(workspaceRoot, folderName, dir, 'node_modules');
      const newScoped = path.join(newScopeDir, folderName, dir, 'node_modules');

      if (fs.existsSync(newScoped)) {
        fs.renameSync(newScoped, nm);
        console.log(`Restored ${folderName} "${dir}" node_modules from scope "${scopeName}".`);
      }
    }
  }
}

function saveScope(workspaceRoot, appsFolder, packagesFolder, scopeName, appsRegex, packagesRegex) {
  const state = readState(workspaceRoot);
  scopeName = scopeName || state.active_scope;

  if (!scopeName) {
    console.error('No active scope. Use "hoist-all s <scope_name>" to create a new scope.');
    process.exit(1);
  }

  appsFolder = appsFolder || state.appsFolder;
  packagesFolder = packagesFolder || state.packagesFolder;
  appsRegex = appsRegex || state.scopes?.[scopeName]?.appsRegex;
  packagesRegex = packagesRegex || state.scopes?.[scopeName]?.packagesRegex;

  const hoistRoot = getHoistRoot(workspaceRoot);
  const scopeDir = path.join(hoistRoot, scopeName);
  fs.mkdirSync(scopeDir, { recursive: true });

  // Save root node_modules
  const rootNM = path.join(workspaceRoot, 'node_modules');
  const scopeNM = path.join(scopeDir, 'node_modules');
  if (fs.existsSync(scopeNM)) fs.rmSync(scopeNM, { recursive: true, force: true });
  if (fs.existsSync(rootNM)) {
    fs.renameSync(rootNM, scopeNM);
    console.log(`Saved root node_modules into scope "${scopeName}".`);
  }

  // Save apps/packages
  if (appsRegex) saveScopedDeps(workspaceRoot, scopeDir, appsFolder, appsRegex);
  if (packagesRegex) saveScopedDeps(workspaceRoot, scopeDir, packagesFolder, packagesRegex);

  // Update state
  state.active_scope = null;
  state.appsFolder = appsFolder;
  state.packagesFolder = packagesFolder;
  state.scopes = state.scopes || {};
  state.scopes[scopeName] = { appsRegex, packagesRegex };
  writeState(workspaceRoot, state);

  console.log(`Saved scope "${scopeName}".`);
}

function installScope(workspaceRoot, scopeName) {
  const state = readState(workspaceRoot);
  const hoistRoot = getHoistRoot(workspaceRoot);
  const rootNM = path.join(workspaceRoot, 'node_modules');

  if (state.active_scope === scopeName) {
    console.log(`Scope "${scopeName}" is already active. Nothing to do.`);
    return;
  }

  const newScopeDir = path.join(hoistRoot, scopeName);
  const newScopeNM = path.join(newScopeDir, 'node_modules');
  if (!fs.existsSync(newScopeNM)) {
    console.error(`Scope "${scopeName}" does not exist at ${newScopeNM}`);
    process.exit(1);
  }

  // Archive old root node_modules
  if (fs.existsSync(rootNM) && state.active_scope) {
    const oldScopeDir = path.join(hoistRoot, state.active_scope);
    const oldScopeNM = path.join(oldScopeDir, 'node_modules');
    if (fs.existsSync(oldScopeNM)) fs.rmSync(oldScopeNM, { recursive: true, force: true });
    fs.renameSync(rootNM, oldScopeNM);
  }

  // Bring new root node_modules
  fs.renameSync(newScopeNM, rootNM);

  // Restore apps/packages
  const oldPackages = (state.active_scope && state.scopes?.[state.active_scope]) || {};
  const newPackages = state.scopes?.[scopeName] || {};
  restoreScopedDeps(workspaceRoot, scopeName, state.appsFolder, oldPackages.appsRegex, newPackages.appsRegex, state);
  restoreScopedDeps(workspaceRoot, scopeName, state.packagesFolder, oldPackages.packagesRegex, newPackages.packagesRegex, state);

  state.active_scope = scopeName;
  writeState(workspaceRoot, state);

  console.log(`Switched active scope to "${scopeName}".`);
}

module.exports = {
  saveScope,
  installScope,
};
