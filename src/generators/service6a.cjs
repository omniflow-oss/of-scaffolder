const path = require("path");
const fs = require("fs-extra");

const registerService6aGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("service6a", {
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
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: true
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const rootPomPath = path.join(rootDir, "pom.xml");

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
          answers.internalLibs = flags.internalLibs || [];
          answers.testDependencies = flags.testDependencies || [];
          if (!answers.groupId) answers.groupId = cfg.groupId || coords.groupId;
          return "OK";
        },
        { type: "add", path: path.join(svcDir, "pom.xml"), templateFile: ctx.template("service", "pom.xml.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/docker/Dockerfile.native"), templateFile: ctx.template("service", "Dockerfile.native.hbs") },
        {
          type: "add",
          path: path.join(svcDir, "src/main/resources/application.properties"),
          templateFile: ctx.template("service", "application.properties.hbs")
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

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath rootPackage}}/module/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },

        async (a) => {
          if (!a.registerInRootPom) return "Skipped root pom module registration";
          const modulePath = path.posix.join("services", a.serviceName);
          const res = await utils.insertModuleIfMissing(rootPomPath, modulePath);
          if (res === null) return "Skipped root pom module registration (no <modules>)";
          return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
        }
      ];
    }
  });
};

module.exports = { registerService6aGenerator };
