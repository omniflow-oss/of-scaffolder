const path = require("path");
const fs = require("fs-extra");
const { validateArtifactId, validateJavaPackage, validateJavaIdentifier, validateRootPath, validateNewRootPath } = require("./src/validators.cjs");
const {
  ensureDir,
  writeIfAbsent,
  toKebab,
  toJavaPackageSafe,
  javaPackageToPath,
  toPascalCase,
  toCamelCase,
  nowIsoDate,
  readPomCoordinates,
  insertModuleIfMissing,
  insertBomDependencyIfMissing
} = require("./src/utils.cjs");

module.exports = function (plop) {
  plop.setWelcomeMessage("Platform scaffolder (Quarkus/Maven/Graal native/GitHub Actions)");

  const template = (...parts) => path.join(__dirname, "templates", ...parts);

  const readRepoConfigSync = (rootDir) => {
    try {
      const configPath = path.join(rootDir, ".platform-scaffolder.json");
      if (!fs.pathExistsSync(configPath)) return {};
      return fs.readJsonSync(configPath) || {};
    } catch {
      return {};
    }
  };

  const listInternalLibs = async (rootDir, cfg) => {
    const seen = new Set();
    const fromCfg = Array.isArray(cfg?.defaults?.service?.internalLibs) ? cfg.defaults.service.internalLibs : [];
    for (const name of fromCfg) seen.add(String(name));

    try {
      const libsDir = path.join(rootDir, "libs");
      if (await fs.pathExists(libsDir)) {
        const entries = await fs.readdir(libsDir);
        for (const entry of entries) {
          const pomPath = path.join(libsDir, entry, "pom.xml");
          if (await fs.pathExists(pomPath)) seen.add(entry);
        }
      }
    } catch {
      // ignore
    }

    return Array.from(seen).filter(Boolean).sort();
  };

  plop.setHelper("kebab", (s) => toKebab(s));
  plop.setHelper("nowIsoDate", () => nowIsoDate());
  plop.setHelper("javaPackagePath", (s) => javaPackageToPath(s));
  plop.setHelper("pascal", (s) => toPascalCase(s));
  plop.setHelper("camel", (s) => toCamelCase(s));

  plop.setGenerator("platform", {
    description: "Bootstrap a new platform repo (root + bom + platform-starter + base folders)",
    prompts: [
      {
        type: "input",
        name: "rootDir",
        message: "Target repo root directory to create (absolute or relative):",
        default: ".",
        validate: validateNewRootPath
      },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: "com.yourorg"
      },
      {
        type: "input",
        name: "platformArtifactId",
        message: "Root artifactId (aggregator parent):",
        default: "platform"
      },
      {
        type: "input",
        name: "platformVersion",
        message: "Platform version:",
        default: "1.0.0-SNAPSHOT"
      },
      {
        type: "input",
        name: "javaVersion",
        message: "Java version:",
        default: "21"
      },
      {
        type: "input",
        name: "quarkusPlatformVersion",
        message: "Quarkus platform version:",
        default: "3.19.1"
      },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: true
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const wfDir = path.join(rootDir, ".github", "workflows");

      return [
        async () => {
          await ensureDir(rootDir);
          if (await fs.pathExists(path.join(rootDir, "pom.xml"))) throw new Error(`pom.xml already exists: ${rootDir}`);
          return "OK";
        },
        { type: "add", path: path.join(rootDir, "pom.xml"), templateFile: template("platform", "root.pom.xml.hbs") },
        { type: "add", path: path.join(rootDir, "bom", "pom.xml"), templateFile: template("platform", "bom.pom.xml.hbs") },
        {
          type: "add",
          path: path.join(rootDir, "platform-starter", "pom.xml"),
          templateFile: template("platform", "platform-starter.pom.xml.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, ".platform-scaffolder.json"),
          templateFile: template("platform", "platform-scaffolder.json.hbs")
        },
        { type: "add", path: path.join(rootDir, ".gitignore"), templateFile: template("platform", "gitignore.hbs") },
        { type: "add", path: path.join(rootDir, "config/checkstyle/checkstyle.xml"), templateFile: template("platform", "checkstyle.xml.hbs") },
        { type: "add", path: path.join(rootDir, "config/spotbugs/exclude.xml"), templateFile: template("platform", "spotbugs-exclude.xml.hbs") },
        async (a) => {
          await ensureDir(path.join(rootDir, "services"));
          await ensureDir(path.join(rootDir, "libs"));

          if (!a.addWorkflows) return "Skipped workflows";
          await ensureDir(wfDir);
          await writeIfAbsent(path.join(wfDir, "ci.yml"), fs.readFileSync(template("workflows", "ci.yml.hbs"), "utf8"));
          await writeIfAbsent(path.join(wfDir, "publish-ghcr.yml"), fs.readFileSync(template("workflows", "publish-ghcr.yml.hbs"), "utf8"));
          return "Added workflows (if absent)";
        }
      ];
    }
  });

  plop.setGenerator("service", {
    description: "Create a new Quarkus service under services/<name>",
    prompts: [
      {
        type: "input",
        name: "rootDir",
        message: "Repo root directory (absolute or relative):",
        default: "../..",
        validate: validateRootPath
      },
      {
        type: "input",
        name: "serviceName",
        message: "Service name (folder/artifactId), e.g. bff, identity, connector-foo:",
        validate: validateArtifactId
      },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package, e.g. com.yourorg.bff:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Also add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg?.defaults?.service?.addWorkflows ?? false;
        }
      },
      {
        type: "confirm",
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg?.defaults?.service?.registerInRootPom ?? true;
        }
      },
      {
        type: "confirm",
        name: "autowireInternalLibs",
        message: "Autowire internal lib dependencies from libs/* ?",
        default: true
      },
      {
        type: "checkbox",
        name: "internalLibs",
        message: "Internal libs to include as dependencies:",
        when: async (a) => {
          if (!a.autowireInternalLibs) return false;
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          const libs = await listInternalLibs(rootDir, cfg);
          return libs.length > 0;
        },
        choices: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          const libs = await listInternalLibs(rootDir, cfg);
          return libs.map((name) => ({ name, value: name }));
        },
        default: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return Array.isArray(cfg?.defaults?.service?.internalLibs) ? cfg.defaults.service.internalLibs : [];
        }
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const rootPomPath = path.join(rootDir, "pom.xml");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");

      return [
        async () => {
          await ensureDir(svcDir);
          if (await fs.pathExists(path.join(svcDir, "pom.xml"))) {
            throw new Error(`Service already exists: ${svcDir}`);
          }

          const cfg = readRepoConfigSync(rootDir);
          if (!answers.groupId) answers.groupId = cfg.groupId;
          if (!answers.platformArtifactId) answers.platformArtifactId = cfg.platformArtifactId;
          if (!answers.platformVersion) answers.platformVersion = cfg.platformVersion;
          if (!Array.isArray(answers.internalLibs) && answers.autowireInternalLibs !== false) {
            answers.internalLibs = Array.isArray(cfg?.defaults?.service?.internalLibs) ? cfg.defaults.service.internalLibs : [];
          }

          const coords = await readPomCoordinates(rootPomPath);
          if (!answers.groupId) answers.groupId = coords.groupId;
          answers.platformVersion = coords.version || answers.platformVersion || "1.0.0-SNAPSHOT";
          answers.platformArtifactId = coords.artifactId || answers.platformArtifactId || "platform";

          return "OK";
        },
        { type: "add", path: path.join(svcDir, "pom.xml"), templateFile: template("service", "pom.xml.hbs") },
        {
          type: "add",
          path: path.join(svcDir, "src/main/docker/Dockerfile.native"),
          templateFile: template("service", "Dockerfile.native.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/resources/application.properties"),
          templateFile: template("service", "application.properties.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/application/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/domain/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/infrastructure/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/config/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/shared/.gitkeep"),
          templateFile: template("service", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/ProfileResource.java"),
          templateFile: template("service", "ProfileResource.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/ErrorResponse.java"),
          templateFile: template("service", "ErrorResponse.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/ErrorCode.java"),
          templateFile: template("service", "ErrorCode.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/GlobalExceptionMapper.java"),
          templateFile: template("service", "GlobalExceptionMapper.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/infrastructure/logging/RequestContextFilter.java"),
          templateFile: template("service", "RequestContextFilter.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/test/java/{{javaPackagePath basePackage}}/ServiceTest.java"),
          templateFile: template("service", "ServiceTest.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/test/java/{{javaPackagePath basePackage}}/ArchitectureTest.java"),
          templateFile: template("service", "ArchitectureTest.java.hbs")
        },
        { type: "add", path: path.join(svcDir, "README.md"), templateFile: template("_common", "README.md.hbs") },
        async (a) => {
          if (!a.autowireInternalLibs) return "Skipped BOM registration for internal libs";
          if (!Array.isArray(a.internalLibs) || a.internalLibs.length === 0) return "No internal libs to register in BOM";
          if (!(await fs.pathExists(bomPomPath))) return "Skipped BOM registration (no bom/pom.xml)";

          const results = [];
          for (const libName of a.internalLibs) {
            const res = await insertBomDependencyIfMissing({
              bomPomPath,
              groupId: a.groupId,
              artifactId: libName,
              versionExpr: "${project.version}"
            });
            results.push(res);
          }
          if (results.some((r) => r === null)) return "Skipped BOM registration (no dependencyManagement/dependencies)";
          if (results.every((r) => r === false)) return "BOM dependencies already present";
          return "Registered internal libs in BOM (if missing)";
        },
        async (a) => {
          if (!a.registerInRootPom) return "Skipped root pom module registration";
          const modulePath = path.posix.join("services", a.serviceName);
          const res = await insertModuleIfMissing(rootPomPath, modulePath);
          if (res === null) return "Skipped root pom module registration (no <modules>)";
          return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
        },
        async (a) => {
          if (!a.addWorkflows) return "Skipped workflows";
          const wfDir = path.join(rootDir, ".github", "workflows");
          await ensureDir(wfDir);

          const ci = fs.readFileSync(template("workflows", "ci.yml.hbs"), "utf8");
          const publish = fs.readFileSync(template("workflows", "publish-ghcr.yml.hbs"), "utf8");

          await writeIfAbsent(path.join(wfDir, "ci.yml"), ci);
          await writeIfAbsent(path.join(wfDir, "publish-ghcr.yml"), publish);
          return "Added workflows (if absent)";
        }
      ];
    }
  });

  plop.setGenerator("lib", {
    description: "Create a new internal lib under libs/<name>",
    prompts: [
      {
        type: "input",
        name: "rootDir",
        message: "Repo root directory (absolute or relative):",
        default: "../..",
        validate: validateRootPath
      },
      {
        type: "input",
        name: "libName",
        message: "Lib name (folder/artifactId), e.g. shared-kernel, observability:",
        validate: validateArtifactId
      },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package, e.g. com.yourorg.sharedkernel:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.libName)}`
      },
      {
        type: "confirm",
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg?.defaults?.lib?.registerInRootPom ?? true;
        }
      },
      {
        type: "confirm",
        name: "registerInBom",
        message: "Register dependency in bom/pom.xml <dependencyManagement>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg?.defaults?.lib?.registerInBom ?? true;
        }
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const libDir = path.join(rootDir, "libs", answers.libName);
      const rootPomPath = path.join(rootDir, "pom.xml");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");

      return [
        async () => {
          await ensureDir(libDir);
          if (await fs.pathExists(path.join(libDir, "pom.xml"))) throw new Error(`Lib already exists: ${libDir}`);

          const cfg = readRepoConfigSync(rootDir);
          if (!answers.groupId) answers.groupId = cfg.groupId;
          if (!answers.platformArtifactId) answers.platformArtifactId = cfg.platformArtifactId;
          if (!answers.platformVersion) answers.platformVersion = cfg.platformVersion;

          const coords = await readPomCoordinates(rootPomPath);
          if (!answers.groupId) answers.groupId = coords.groupId;
          answers.platformVersion = coords.version || answers.platformVersion || "1.0.0-SNAPSHOT";
          answers.platformArtifactId = coords.artifactId || answers.platformArtifactId || "platform";

          return "OK";
        },
        { type: "add", path: path.join(libDir, "pom.xml"), templateFile: template("lib", "pom.xml.hbs") },
        { type: "add", path: path.join(libDir, "README.md"), templateFile: template("lib", "README.md.hbs") },
        {
          type: "add",
          path: path.join(libDir, "src/main/java/{{javaPackagePath basePackage}}/.gitkeep"),
          templateFile: template("lib", "gitkeep.hbs")
        },
        {
          type: "add",
          path: path.join(libDir, "src/test/java/{{javaPackagePath basePackage}}/LibTest.java"),
          templateFile: template("lib", "LibTest.java.hbs")
        },
        async (a) => {
          if (a.registerInRootPom) {
            const modulePath = path.posix.join("libs", a.libName);
            const res = await insertModuleIfMissing(rootPomPath, modulePath);
            if (res === null) return "Skipped root pom module registration (no <modules>)";
            return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
          }
          return "Skipped root pom module registration";
        },
        async (a) => {
          if (!a.registerInBom) return "Skipped BOM registration";
          if (!(await fs.pathExists(bomPomPath))) return "Skipped BOM registration (no bom/pom.xml)";
          const res = await insertBomDependencyIfMissing({
            bomPomPath,
            groupId: a.groupId,
            artifactId: a.libName,
            versionExpr: "${project.version}"
          });
          if (res === null) return "Skipped BOM registration (no dependencyManagement/dependencies)";
          return res ? `Registered BOM dependency: ${a.libName}` : `BOM dependency already present: ${a.libName}`;
        }
      ];
    }
  });

  plop.setGenerator("connector", {
    description: "Add a connector extension point inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package for the service:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      { type: "input", name: "connectorName", message: "Connector name (kebab or word), e.g. stripe, salesforce:", validate: validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/application/connectors/{{pascal connectorName}}Connector.java"),
          templateFile: template("golden", "ConnectorPort.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/infrastructure/connectors/{{pascal connectorName}}HttpConnector.java"
          ),
          templateFile: template("golden", "ConnectorAdapter.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/config/{{pascal connectorName}}ConnectorConfig.java"),
          templateFile: template("golden", "ConnectorConfig.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("feature", {
    description: "Add a feature module (use case + policy + query) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package for the service:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      { type: "input", name: "featureName", message: "Feature name (kebab or word), e.g. billing, onboarding:", validate: validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/application/features/{{pascal featureName}}/Create{{pascal featureName}}UseCase.java"
          ),
          templateFile: template("golden", "CreateUseCase.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/application/features/{{pascal featureName}}/Get{{pascal featureName}}Query.java"
          ),
          templateFile: template("golden", "GetQuery.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/domain/policies/Apply{{pascal featureName}}Policy.java"
          ),
          templateFile: template("golden", "ApplyPolicy.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("endpoint", {
    description: "Add a new screen endpoint (resource + DTO + use case) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package for the service:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      { type: "input", name: "endpointName", message: "Endpoint name (kebab or word), e.g. profile, tenant-settings:", validate: validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/{{pascal endpointName}}Resource.java"),
          templateFile: template("golden", "EndpointResource.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/dto/{{pascal endpointName}}Response.java"),
          templateFile: template("golden", "EndpointResponse.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/application/usecases/Get{{pascal endpointName}}UseCase.java"
          ),
          templateFile: template("golden", "EndpointUseCase.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("projection", {
    description: "Add a data projection skeleton (domain + repository + adapter) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = readRepoConfigSync(rootDir);
          return cfg.groupId || "com.yourorg";
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package for the service:",
        validate: validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      { type: "input", name: "projectionName", message: "Projection name (kebab or word), e.g. customer, usage:", validate: validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/domain/projections/{{pascal projectionName}}Projection.java"),
          templateFile: template("golden", "Projection.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/domain/projections/{{pascal projectionName}}ProjectionRepository.java"
          ),
          templateFile: template("golden", "ProjectionRepository.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            svcDir,
            "src/main/java/{{javaPackagePath basePackage}}/infrastructure/projections/InMemory{{pascal projectionName}}ProjectionRepository.java"
          ),
          templateFile: template("golden", "ProjectionAdapter.java.hbs")
        }
      ];
    }
  });
};
