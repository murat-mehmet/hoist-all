hoist-all
=========

**hoist-all** is an **NPM package** that copies all modules from `node_modules` folders inside application subdirectories (e.g., `apps/*`) to the root-level `node_modules`. This can be useful for monorepo workspaces where you want to make modules globally accessible without re-installing them in the root.

Installation
------------

    npm install hoist-all --save-dev


Usage
-----

You can run `hoist-all` via the command line.

### CLI

    npx hoist-all [appsFolder] [workspaceRoot]


*   `appsFolder` (optional) - Name of the folder containing app directories. Defaults to `apps`.
*   `workspaceRoot` (optional) - Path to the workspace root. Defaults to current working directory.

Features
--------

*   Copies (not moves) modules from app-level `node_modules` to the root-level `node_modules`.
*   Skips folders starting with `.` and other known system folders.
*   Silent skip for already existing modules.
*   Reports total number of copied modules per app.
*   No third-party dependencies.

Example
-------

Suppose you have the following structure:

    my-workspace/
      node_modules/
      apps/
        app1/
          node_modules/
            lodash/
        app2/
          node_modules/
            axios/


Running `npx hoist-all` will copy `lodash` and `axios` into the root-level `node_modules`.

License
-------

MIT
