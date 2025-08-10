#!/usr/bin/env node
const hoistAll = require("../lib/copyAppNodeModules");

if (require.main === module) {
  const [appsFolder, workspaceRoot] = process.argv.slice(2);
  hoistAll(workspaceRoot || process.cwd(), appsFolder || 'apps');
}

