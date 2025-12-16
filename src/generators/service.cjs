const path = require("path");
const fs = require("fs-extra");

const registerServiceGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("service", {
    description: "Create a Rev6A Quarkus service skeleton (boot/shared/module) under services/<name>",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Service name (folder/artifactId):", validate: validators.validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultGroupId(rootDir) || "";
        }
      },
      {
        type: "input",
        name: "rootPackage",
        message: "Root Java package, e.g. com.yourcompany.yourapp:",
        validate: validators.validateJavaPackage,
        default: (a) => `${a.groupId}.${utils.toJavaPackageSafe(a.serviceName)}`
      },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Also add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).addWorkflows;
        }
      },
      {
        type: "confirm",
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).registerInRootPom;
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
          const cfg = ctx.readRepoConfigSync(rootDir);
          const libs = await ctx.listInternalLibs(rootDir, cfg);
          return libs.length > 0;
        },
        choices: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = ctx.readRepoConfigSync(rootDir);
          const libs = await ctx.listInternalLibs(rootDir, cfg);
          return libs.map((name) => ({ name, value: name }));
        },
        default: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).internalLibs;
        }
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const rootPomPath = path.join(rootDir, "pom.xml");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");
      const wfDir = path.join(rootDir, ".github", "workflows");

      return [
        async () => {
          await fs.ensureDir(svcDir);
          if (await fs.pathExists(path.join(svcDir, "pom.xml"))) throw new Error(`Service already exists: ${svcDir}`);
          const coords = await utils.readPomCoordinates(rootPomPath);
          if (!coords.version) throw new Error(`Could not determine platform version from: ${rootPomPath}`);
          if (!coords.artifactId) throw new Error(`Could not determine platform artifactId from: ${rootPomPath}`);
          answers.platformVersion = coords.version;
          answers.platformArtifactId = coords.artifactId;

          const cfg = ctx.readRepoConfigSync(rootDir);
          const flags = ctx.defaultServiceFlags(rootDir);
          answers.dockerBaseImage = flags.dockerBaseImage || cfg?.defaults?.service?.dockerBaseImage;
          if (!answers.dockerBaseImage) {
            throw new Error(`Missing dockerBaseImage; set defaults.service.dockerBaseImage in ${path.join(rootDir, ".platform-scaffolder.json")}`);
          }
          answers.quarkusExtensions = flags.quarkusExtensions || [];
          if (answers.quarkusExtensions.length === 0) {
            throw new Error(`Missing quarkusExtensions; set defaults.service.quarkusExtensions in ${path.join(rootDir, ".platform-scaffolder.json")}`);
          }
          if (!Array.isArray(answers.internalLibs) && answers.autowireInternalLibs !== false) {
            answers.internalLibs = flags.internalLibs || [];
          }
          answers.testDependencies = flags.testDependencies || [];
          if (answers.testDependencies.length === 0) {
            throw new Error(`Missing testDependencies; set defaults.service.testDependencies in ${path.join(rootDir, ".platform-scaffolder.json")}`);
          }
          if (!answers.groupId) answers.groupId = cfg.groupId || coords.groupId;
          return "OK";
        },
        { type: "add", path: path.join(svcDir, "pom.xml"), templateFile: ctx.template("rev6a", "service", "pom.xml.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/docker/Dockerfile.native"), templateFile: ctx.template("rev6a", "service", "Dockerfile.native.hbs") },
        {
          type: "add",
          path: path.join(svcDir, "src/main/resources/application.properties"),
          templateFile: ctx.template("rev6a", "service", "application.properties.hbs")
        },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/boot/Application.java"), templateFile: ctx.template("rev6a", "boot", "Application.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/boot/Wiring.java"), templateFile: ctx.template("rev6a", "boot", "Wiring.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/result/Result.java"), templateFile: ctx.template("rev6a", "shared", "contract", "result", "Result.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/result/Success.java"), templateFile: ctx.template("rev6a", "shared", "contract", "result", "Success.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/result/Failure.java"), templateFile: ctx.template("rev6a", "shared", "contract", "result", "Failure.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/error/Error.java"), templateFile: ctx.template("rev6a", "shared", "contract", "error", "Error.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/error/ErrorCategory.java"), templateFile: ctx.template("rev6a", "shared", "contract", "error", "ErrorCategory.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/error/ErrorDetails.java"), templateFile: ctx.template("rev6a", "shared", "contract", "error", "ErrorDetails.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/event/EventEnvelope.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventEnvelope.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/event/EventMetadata.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventMetadata.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/event/EventPublisherPort.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventPublisherPort.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/contract/event/EventSubscriberPort.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventSubscriberPort.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/http/ResultHttpRenderer.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "http", "ResultHttpRenderer.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/http/GlobalThrowableRenderer.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "http", "GlobalThrowableRenderer.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/http/CorrelationIdFilter.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "http", "CorrelationIdFilter.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/http/ValidationErrorRenderer.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "http", "ValidationErrorRenderer.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/eventbus/inmemory/InMemoryEventBusAdapter.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "eventbus", "inmemory", "InMemoryEventBusAdapter.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/strategy/NamedStrategy.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "strategy", "NamedStrategy.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/strategy/StrategyNotFoundError.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "strategy", "StrategyNotFoundError.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/shared/infrastructure/strategy/StrategySelectorSupport.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "strategy", "StrategySelectorSupport.java.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/module/.gitkeep"), templateFile: ctx.template("rev6a", "service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/test/java/{{javaPackagePath rootPackage}}/Rev6AArchitectureTest.java"), templateFile: ctx.template("rev6a", "test", "Rev6AArchitectureTest.java.hbs") },
        { type: "add", path: path.join(svcDir, "README.md"), templateFile: ctx.template("_common", "README.md.hbs") },

        async (a) => {
          if (!a.autowireInternalLibs) return "Skipped BOM registration for internal libs";
          if (!Array.isArray(a.internalLibs) || a.internalLibs.length === 0) return "No internal libs to register in BOM";
          if (!(await fs.pathExists(bomPomPath))) return "Skipped BOM registration (no bom/pom.xml)";

          const results = [];
          for (const libName of a.internalLibs) {
            const res = await utils.insertBomDependencyIfMissing({
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
          const res = await utils.insertModuleIfMissing(rootPomPath, modulePath);
          if (res === null) return "Skipped root pom module registration (no <modules>)";
          return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
        },
        async (a) => {
          if (!a.addWorkflows) return "Skipped workflows";
          await fs.ensureDir(wfDir);
          await utils.writeIfAbsent(path.join(wfDir, "ci.yml"), fs.readFileSync(ctx.template("workflows", "ci.yml.hbs"), "utf8"));
          await utils.writeIfAbsent(path.join(wfDir, "publish-ghcr.yml"), fs.readFileSync(ctx.template("workflows", "publish-ghcr.yml.hbs"), "utf8"));
          return "Added workflows (if absent)";
        }
      ];
    }
  });
};

module.exports = { registerServiceGenerator };
