# Platform Scaffolder (Quarkus/Maven)

Plop-based scaffolder that generates:

- A Maven multi-module **platform skeleton** (root + `bom/` + `platform-starter/`) via the `platform` generator
- A Quarkus **service module** under `services/<serviceName>`
- A Java **library module** under `libs/<libName>`
- Golden-path building blocks inside services: `connector`, `feature`, `endpoint`, `projection`
- A feature-local **in-memory EventBus** skeleton: `eventbus` (no Kafka by default)
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

### 3) Generate a service

```bash
npx @ofcx/of-scaffolder service
```

The service generator reads `.platform-scaffolder.json` for defaults:

- Quarkus extensions (`defaults.service.quarkusExtensions`)
- Service test deps (`defaults.service.testDependencies`)
- Docker base image (`defaults.service.dockerBaseImage`)
- Internal libs to autowire (`defaults.service.internalLibs`)

### 4) Add paved-road building blocks to an existing service

Run from anywhere inside your repo and point `rootDir` to the repo root when asked.

```bash
npx @ofcx/of-scaffolder connector
npx @ofcx/of-scaffolder feature
npx @ofcx/of-scaffolder endpoint
npx @ofcx/of-scaffolder projection
npx @ofcx/of-scaffolder eventbus
npx @ofcx/of-scaffolder service6a
npx @ofcx/of-scaffolder usecase6a
npx @ofcx/of-scaffolder eventbus6a
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
npm run plop -- service
npm run plop -- lib
npm run plop -- connector
npm run plop -- feature
npm run plop -- endpoint
npm run plop -- projection
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
npx @ofcx/of-scaffolder service
npx @ofcx/of-scaffolder lib
npx @ofcx/of-scaffolder connector
npx @ofcx/of-scaffolder feature
npx @ofcx/of-scaffolder endpoint
npx @ofcx/of-scaffolder projection
npx @ofcx/of-scaffolder eventbus
```

## Generator: platform

Bootstraps a new repo root with:

- `pom.xml` (aggregator parent + shared properties)
- `bom/pom.xml` (imports Quarkus platform BOM + manages internal libs)
- `platform-starter/pom.xml` (parent for services/libs; imports `platform-bom`; pluginManagement + `native` + `quality`)
- `.platform-scaffolder.json` (defaults consumed by `service`/`lib` generators)
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

### Quarkus extensions (config-driven)

Generated service POMs are driven by `.platform-scaffolder.json`:

- `.platform-scaffolder.json` → `defaults.service.quarkusExtensions` controls which `io.quarkus:*` dependencies are added.
- `.platform-scaffolder.json` → `defaults.service.testDependencies` controls test dependencies (Quarkus test, RestAssured, ArchUnit, etc.).

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

Generated services include an ArchUnit test (`ArchitectureTest`) enforcing layer boundaries.

## Rev6A generators (boot/shared/module)

If you want the Rev6A “usecase-per-package” structure (boot + shared contract/infrastructure + module/<module>/<usecase>):

- `service6a`: creates a service skeleton under `services/<name>` with `boot/`, `shared/`, and `module/`
- `usecase6a`: adds a canonical usecase tree under `module/<module>/<usecase>/...`
- `eventbus6a`: adds the shared in-memory event bus contract + adapter (no Kafka)

## Environment defaults (this repo)

When running the `platform` generator, prompt defaults can be overridden via environment variables (useful in CI):

- `OFCX_GROUP_ID`
- `OFCX_PLATFORM_ARTIFACT_ID`
- `OFCX_QUARKUS_PLATFORM_VERSION`
- `OFCX_JAVA_VERSION`
- `OFCX_MANDREL_BUILDER_IMAGE`
- `OFCX_DOCKER_BASE_IMAGE`
- `OFCX_MAVEN_MIN_VERSION`

## Safety / validation

- Will error if `services/<serviceName>/pom.xml` already exists.
- Will error if `libs/<libName>/pom.xml` already exists.
- Enforces kebab-case for `serviceName`/`libName`.
- Validates `rootDir` by requiring a `pom.xml` at that path.
