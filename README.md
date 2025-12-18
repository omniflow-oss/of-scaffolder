# Platform Scaffolder (Quarkus/Maven)

Plop-based scaffolder that generates:

- A Maven multi-module **platform skeleton** (root + `bom/` + `platform-starter/`) via the `platform` generator
- A Java **library module** under `libs/<libName>`
- Rev6A building blocks inside services: `modules`, `usecase`, `eventbus`
- Optional GitHub Actions workflows (CI + GHCR publish) under `.github/workflows/` (only if absent)

It is designed for a Maven “platform” repo layout (root `pom.xml` at the repo root) and refuses to overwrite existing modules.

## Requirements

- Node.js 18+ (tested with Node 20)
- npm
- A target repo with a root `pom.xml` (used to validate `rootDir`)

## How to use (quickstart)

### 1) Bootstrap a new platform repo

From an empty directory:

```bash
npx @ofcx/of-scaffolder platform
```

This generates:

- `pom.xml`, `bom/pom.xml`, `platform-starter/pom.xml`
- `.platform-scaffolder.json` (all defaults used by generators)
- `services/` and `libs/`
- `config/checkstyle/checkstyle.xml` + `config/spotbugs/exclude.xml`
- optional `.github/workflows/*` if you enable it

### 2) Generate a library

```bash
npx @ofcx/of-scaffolder lib
```

Recommended: keep internal libs versioned via the BOM by answering “yes” to `registerInBom`.

### 3) Add a usecase to an existing service

```bash
npx @ofcx/of-scaffolder usecase
```

The `usecase` generator bootstraps (idempotent) the Rev6A `boot/` skeleton inside the service, and ensures baseline Quarkus + platform-core dependencies are present in `services/<serviceName>/pom.xml` (from `.platform-scaffolder.json`).

### 4) Add paved-road building blocks to an existing service

Run from anywhere inside your repo and point `rootDir` to the repo root when asked.

```bash
npx @ofcx/of-scaffolder modules
npx @ofcx/of-scaffolder usecase
npx @ofcx/of-scaffolder eventbus
```

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
npm run plop -- lib
npm run plop -- modules
npm run plop -- usecase
npm run plop -- eventbus
```

## Use via npx

From any repo directory:

```bash
npx @ofcx/of-scaffolder
```

Run a specific generator:

```bash
npx @ofcx/of-scaffolder platform
npx @ofcx/of-scaffolder lib
npx @ofcx/of-scaffolder modules
npx @ofcx/of-scaffolder usecase
npx @ofcx/of-scaffolder eventbus
```

## Generator: platform

Bootstraps a new repo root with:

- `pom.xml` (aggregator parent + shared properties)
- `bom/pom.xml` (imports Quarkus platform BOM + manages internal libs)
- `platform-starter/pom.xml` (parent for services/libs; imports `platform-bom`; pluginManagement + `native` + `quality`)
- `.platform-scaffolder.json` (defaults consumed by `usecase`/`lib` generators)
- `services/` and `libs/` directories
- `.gitignore`
- `config/checkstyle/checkstyle.xml` and `config/spotbugs/exclude.xml`
- Optional workflows under `.github/workflows/`

Safety: refuses to run if `pom.xml` already exists in the target `rootDir`.

### Version configuration

The platform generator writes versions into the root `pom.xml` as properties (Java, Quarkus platform, Mandrel builder image, and quality tool/plugin versions), and also records them in `.platform-scaffolder.json` under `versions` for generator defaults.

Generated CI workflows expect GitHub repository variables:

- `JAVA_VERSION`
- `MANDREL_BUILDER_IMAGE`
- `IMAGE_REGISTRY` (e.g. `ghcr.io`)

Publish to GHCR workflow variables (optional):

- `IMAGE_TAG_LATEST` (set to `latest` if you want a “latest” tag; otherwise only SHA tags are pushed)

### Prompts (usecase/modules/eventbus)

`usecase` will create `services/<serviceName>/pom.xml` if it does not exist yet (and will register the module in the root `pom.xml`). `modules` and `eventbus` expect the service `pom.xml` to exist.

### Prompts (lib)

- `rootDir`: repo root directory (absolute or relative to this scaffolder)
- `libName`: kebab-case artifactId/folder name (e.g. `shared-kernel`, `observability`)
- `groupId`: Maven groupId (defaults from `.platform-scaffolder.json` if present)
- `basePackage`: Java package (default derived from `groupId` + lib name)
- `registerInRootPom`: defaults from `.platform-scaffolder.json` if present
- `registerInBom`: defaults from `.platform-scaffolder.json` if present

## What gets generated

### Modules + usecases (inside `services/<serviceName>`)

- `modules`: creates `src/main/java/<rootPackage>/module/<module>/.gitkeep`
- `usecase`: creates the canonical usecase tree under `src/main/java/<rootPackage>/module/<module>/<usecase>usecase/...`
- `usecase`: bootstraps (if absent) `boot/` and `src/test/.../Rev6AArchitectureTest.java`
- `usecase`: ensures baseline Quarkus/test dependencies exist in `services/<serviceName>/pom.xml` (from `.platform-scaffolder.json`)

### Lib (`libs/<libName>`)

- `pom.xml`
- `src/main/java/<basePackage>/.gitkeep`
- `src/test/.../LibTest.java`
- `README.md`

### Workflows (optional)

- `.github/workflows/ci.yml`
- `.github/workflows/publish-ghcr.yml`

These are only written if the files do not already exist.

## Usecase POM defaults (config-driven)

The `usecase` generator patches `services/<serviceName>/pom.xml` using:

- `.platform-scaffolder.json` → `defaults.usecase.pom.dependencies`
- `.platform-scaffolder.json` → `defaults.usecase.pom.testDependencies`

Generated lib POMs are driven by `.platform-scaffolder.json`:

- `.platform-scaffolder.json` → `defaults.lib.testDependencies` controls test dependencies for libs (e.g. `org.junit.jupiter:junit-jupiter`).

## Idempotent edits

The `platform` generator seeds markers that make subsequent module/dependency insertion stable and idempotent:

- Root `pom.xml`: `<!-- scaffolder:modules:start -->` / `<!-- scaffolder:modules:end -->`
- `bom/pom.xml`: `<!-- scaffolder:deps:start -->` / `<!-- scaffolder:deps:end -->`

If markers are missing (existing repos), the scaffolder falls back to inserting near the end of the corresponding sections.

## Guardrails (quality + architecture)

Generated repos include a `quality` Maven profile (in `platform-starter/pom.xml`) that runs:

- Spotless (Google Java Format)
- Checkstyle
- SpotBugs

Generated services include an ArchUnit test (`Rev6AArchitectureTest`) enforcing:

- `shared` must not depend on `module`
- usecases must not depend on each other
- `domain`/`application` must not depend on `infrastructure`

## Environment defaults (this repo)

When running the `platform` generator, prompt defaults can be overridden via environment variables (useful in CI):

- `OFCX_GROUP_ID`
- `OFCX_PLATFORM_ARTIFACT_ID`
- `OFCX_QUARKUS_PLATFORM_VERSION`
- `OFCX_JAVA_VERSION`
- `OFCX_MANDREL_BUILDER_IMAGE`
- `OFCX_MAVEN_MIN_VERSION`

## Safety / validation

- `usecase` will create `services/<serviceName>/pom.xml` if missing.
- `modules`/`eventbus` will error if `services/<serviceName>/pom.xml` is missing.
- Will error if `libs/<libName>/pom.xml` already exists.
- Enforces kebab-case for `serviceName`/`libName`.
- Validates `rootDir` by requiring a `pom.xml` at that path.
