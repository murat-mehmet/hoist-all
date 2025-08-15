#!/usr/bin/env node

// cli.js
const { Command } = require('commander');
const path = require('path');
const hoistAll = require('../lib/hoist-all.js');

const program = new Command();
program.enablePositionalOptions();

program
  .name('hoist-all')
  .description('Hoist or reverse-hoist node_modules between workspace root and apps')
  .version('1.0.0');

program
  .argument('[app]', 'App to hoist')
  .option('-r, --root <path>', 'Path to the workspace root', process.cwd())
  .option('-a, --apps <path>', 'Folder containing your apps', 'apps')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((app, options) => {
    if (options.verbose) {
      console.log(`Workspace root: ${path.resolve(options.root)}`);
      console.log(`Apps folder: ${path.resolve(options.root, options.apps)}`);
    }

    hoistAll({workspaceRoot: options.root, appsFolder: options.apps, app: app});
  });

program.parse(process.argv);
