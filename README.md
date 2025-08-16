# TL;DR

This package fixes errors caused by modules not being found because they exist only in an app’s local `node_modules`.
It hoists (or reverses) them into the right place and now supports **scoping**, so you can easily switch between sets of dependencies (e.g. `mobile`, `web`) without reinstalling everything.

---

# hoist-all

**hoist-all** is an **NPM package** for managing dependencies in **monorepos**.
It supports two main features:

1. **Hoisting** – copy/symlink modules from app-level `node_modules` into the root `node_modules`.
2. **Scoped installs** – isolate sets of `node_modules` into named scopes (`mobile`, `web`, etc.) and switch between them instantly.

---

## Installation

Install it in the root `package.json`:

```sh
npm install hoist-all --save-dev
```

---

## Usage

### 1. Postinstall Hoisting (classic mode)

Add it to the root `package.json`:

```json
"scripts": {
  "postinstall": "hoist-all"
}
```

After you run:

```sh
npm i -w your_app
```

`hoist-all` will automatically symlink or copy dependencies into the root `node_modules`.

---

### 2. Scoped Workspaces (new)

You can now **save and switch between scopes**.
This is useful if you have many apps/packages but only want certain ones active at a time.

#### Save a scope

```sh
hoist-all s mobile "app1|app2" "shared|ui"
```

* `mobile` → the scope name
* `"app1|app2"` → regex for apps to include
* `"shared|ui"` → regex for packages to include

This saves the current `node_modules` into `.hoist-all/mobile/` and remembers your regex filters.

#### Install a scope

```sh
hoist-all i mobile
```

* Restores `node_modules` from `.hoist-all/mobile/`
* Applies your app/package filters
* Switches `active_scope` in `.hoist-all/state.json`

#### Example

```
my-workspace/
  apps/
    app1/
    app2/
    app3/
  packages/
    shared/
    utils/
  node_modules/

# Save only app1 + shared into "mobile" scope
hoist-all s mobile "app1" "shared"

# Switch to mobile
hoist-all i mobile
```

---

## CLI Reference

```sh
hoist-all [appsFolder] [workspaceRoot]
```

* `appsFolder` (optional) – Defaults to `apps`
* `workspaceRoot` (optional) – Defaults to `cwd`

### Scope Commands

```sh
hoist-all s <scopeName> [appsRegex] [packagesRegex]
```

* `-a, --apps <path>` – Folder containing apps (default: `apps`)
* `-p, --packages <path>` – Folder containing packages (default: `packages`)

```sh
hoist-all i <scopeName>
```

Install a previously saved scope.

```sh
hoist-all ls
```

List available scopes and show the active one.

---

## Features

* Hoist mode: Copy/symlink modules from app-level `node_modules` → root.
* Reverse-hoist mode: If `hoist.target = "app"`, copy from root → app.
* Scoped dependency management:

    * Save root + app/package `node_modules` into `.hoist-all/<scope>`
    * Restore instantly without reinstall
* Regex-based filtering for apps/packages
* Skips system folders silently
* Reports copied/restored modules
* Zero runtime dependencies

---

## Configuration

### App-level config

Each app can define where dependencies should live:

```json
{
  "name": "my-app",
  "hoist": {
    "target": "root"   // or "app"
  }
}
```

Default is `"root"`.

### Scope config (auto-managed)

Stored in `.hoist-all/state.json`:

```json
{
  "active_scope": "mobile",
  "appsFolder": "apps",
  "packagesFolder": "packages",
  "scopes": {
    "mobile": {
      "appsRegex": "app1|app2",
      "packagesRegex": "shared|ui"
    }
  }
}
```

---

## Example

### Workspace

```
my-workspace/
  node_modules/
  apps/
    app1/
      node_modules/
        lodash/
    app2/
      node_modules/
        axios/
```

### Classic hoist

```sh
npx hoist-all
```

Result: `lodash` and `axios` appear in the root `node_modules`.

### Scoped workflow

```sh
# Save a scope
hoist-all s web "app2" "ui"

# Switch scopes
hoist-all i mobile
hoist-all i web
```

---

## License

MIT
