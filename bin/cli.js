#!/usr/bin/env node
const copyAppNodeModules = require("../lib/copyAppNodeModules");

if (require.main === module) {
  const [appsFolder, workspaceRoot] = process.argv.slice(2);
  copyAppNodeModules(workspaceRoot || process.cwd(), appsFolder || "apps");
}
