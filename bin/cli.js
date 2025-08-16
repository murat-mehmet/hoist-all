#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const hoistAll = require('../lib/hoist-all.js');
const { saveScope, installScope } = require('../lib/scope-manager');

const program = new Command();
program.enablePositionalOptions();

program
  .name('hoist-all')
  .description('Hoist or reverse-hoist node_modules between workspace root and apps/packages')
  .version('1.0.0');

program
  .command('s [scopeName] [appsRegex] [packagesRegex]')
  .description('Save current active scope with optional apps/packages regex')
  .option('-r, --root <path>', 'Path to the workspace root', process.cwd())
  .option('-a, --apps <path>', 'Folder containing your apps', 'apps')
  .option('-p, --packages <path>', 'Folder containing your packages', 'packages')
  .action((scopeName, appsRegex, packagesRegex, options) => {
    saveScope(
      options.root,
      options.apps,
      options.packages,
      scopeName || null,
      appsRegex || null,
      packagesRegex || null
    );
  });

program
  .command('i <scope>')
  .description('Install (activate) a saved scope')
  .action((scope) => {
    const workspaceRoot = process.cwd();
    installScope(workspaceRoot, scope);
  });

program
  .argument('[app]', 'App to hoist')
  .option('-r, --root <path>', 'Path to the workspace root', process.cwd())
  .option('-a, --apps <path>', 'Folder containing your projects', 'apps')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((app, options) => {
    if (options.verbose) {
      console.log(`Workspace root: ${path.resolve(options.root)}`);
      console.log(`Projects folder: ${path.resolve(options.root, options.apps)}`);
    }
    hoistAll({ workspaceRoot: options.root, appsFolder: options.apps, app });
  });

program.parse(process.argv);
