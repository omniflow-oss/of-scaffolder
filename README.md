# Platform Scaffolder (Quarkus/Maven)

Plop-based scaffolder that generates:

- A Maven multi-module **platform skeleton** (root + `bom/` + `platform-starter/`) via the `platform` generator
- A Quarkus **service module** under `services/<serviceName>`
- A Java **library module** under `libs/<libName>`
- Optional GitHub Actions workflows (CI + GHCR publish) under `.github/workflows/` (only if absent)

It is designed for a Maven “platform” repo layout (root `pom.xml` at the repo root) and refuses to overwrite existing modules.

## Requirements

- Node.js 18+ (tested with Node 20)
- npm
- A target repo with a root `pom.xml` (used to validate `rootDir`)

## Install

From this directory:

```bash
npm install
```

## Run tests

```bash
npm test
```

Note: tests run Jest in ESM mode via `node --experimental-vm-modules` (you may see an experimental warning).

### Maven smoke test (opt-in)

There is an opt-in integration test that generates a repo and runs `mvn clean verify`:

```bash
npm run test:maven
```

This requires a working Maven + JDK setup and network access to download dependencies (or a warmed local Maven cache).

## GitHub Actions

- `.github/workflows/ci.yml`: runs `npm ci` + `npm test` on PRs and pushes to `main`
- `.github/workflows/maven-smoke.yml`: runs the Maven smoke test on a nightly schedule and on manual dispatch
- `.github/workflows/publish-npm.yml`: publishes to npm on tags like `v0.1.0` (requires `NPM_TOKEN` secret)

## Publishing to npm

1. Create an npm access token with publish rights for the `@ofcx` scope.
2. Add it to GitHub repo secrets as `NPM_TOKEN`.
3. Bump `package.json` version and push a tag:
   - `git tag v0.1.0 && git push --tags`

## Use the generators

Run Plop and pick a generator:

```bash
npm run plop
```

Or run a specific generator:

```bash
npm run plop -- platform
npm run plop -- service
npm run plop -- lib
```

## Use via npx

From any repo directory:

```bash
npx @ofcx/of-scaffolder
```

Run a specific generator:

```bash
npx @ofcx/of-scaffolder platform
npx @ofcx/of-scaffolder service
npx @ofcx/of-scaffolder lib
```

## Generator: platform

Bootstraps a new repo root with:

- `pom.xml` (aggregator parent + imports `platform-bom`)
- `bom/pom.xml` (imports Quarkus platform BOM)
- `platform-starter/pom.xml` (pluginManagement + `native` profile)
- `.platform-scaffolder.json` (defaults consumed by `service`/`lib` generators)
- `services/` and `libs/` directories
- `.gitignore`
- Optional workflows under `.github/workflows/`

Safety: refuses to run if `pom.xml` already exists in the target `rootDir`.

### Prompts (service)

- `rootDir`: repo root directory (absolute or relative to this scaffolder)
- `serviceName`: kebab-case artifactId/folder name (e.g. `bff`, `connector-foo`)
- `groupId`: Maven groupId (defaults from `.platform-scaffolder.json` if present)
- `basePackage`: Java package (default derived from `groupId` + service name)
- `addWorkflows`: defaults from `.platform-scaffolder.json` if present
- `registerInRootPom`: defaults from `.platform-scaffolder.json` if present

### Prompts (lib)

- `rootDir`: repo root directory (absolute or relative to this scaffolder)
- `libName`: kebab-case artifactId/folder name (e.g. `shared-kernel`, `observability`)
- `groupId`: Maven groupId (defaults from `.platform-scaffolder.json` if present)
- `basePackage`: Java package (default derived from `groupId` + lib name)
- `registerInRootPom`: defaults from `.platform-scaffolder.json` if present
- `registerInBom`: defaults from `.platform-scaffolder.json` if present

## What gets generated

### Service (`services/<serviceName>`)

- `pom.xml` (parent = `platform-starter`; optionally autowires internal libs)
- `src/main/resources/application.properties`
- `src/main/docker/Dockerfile.native`
- Java package skeleton:
  - `api/`, `application/`, `domain/`, `infrastructure/`, `config/`
- Minimal endpoint + error model:
  - `api/ProfileResource.java` (`GET /healthz`)
  - `api/error/ErrorCode.java`, `ErrorResponse.java`, `GlobalExceptionMapper.java`
- `src/test/.../ServiceTest.java` (Quarkus test)
- `README.md`

### Lib (`libs/<libName>`)

- `pom.xml`
- `src/main/java/<basePackage>/.gitkeep`
- `src/test/.../LibTest.java`
- `README.md`

### Workflows (optional)

- `.github/workflows/ci.yml`
- `.github/workflows/publish-ghcr.yml`

These are only written if the files do not already exist.

## Optional autowire (service deps)

If `.platform-scaffolder.json` exists, the `service` generator defaults internal dependencies from:

- `.platform-scaffolder.json` → `defaults.service.internalLibs` (e.g. `["shared-kernel"]`)

You can also choose interactively (it will suggest libs discovered under `libs/*/pom.xml`).

## Idempotent edits

The `platform` generator seeds markers that make subsequent module/dependency insertion stable and idempotent:

- Root `pom.xml`: `<!-- scaffolder:modules:start -->` / `<!-- scaffolder:modules:end -->`
- `bom/pom.xml`: `<!-- scaffolder:deps:start -->` / `<!-- scaffolder:deps:end -->`

If markers are missing (existing repos), the scaffolder falls back to inserting near the end of the corresponding sections.

## Safety / validation

- Will error if `services/<serviceName>/pom.xml` already exists.
- Will error if `libs/<libName>/pom.xml` already exists.
- Enforces kebab-case for `serviceName`/`libName`.
- Validates `rootDir` by requiring a `pom.xml` at that path.
