const path = require("path");
const fs = require("fs-extra");
const { defaults } = require("../scaffolder/defaults.cjs");

const registerPlatformGenerator = ({ plop, ctx, validators, utils }) => {
  const d = defaults();
  plop.setGenerator("platform", {
    description: "Bootstrap a new platform repo (root + bom + platform-starter + base folders)",
    prompts: [
      {
        type: "input",
        name: "rootDir",
        message: "Target repo root directory to create (absolute or relative):",
        default: ".",
        validate: validators.validateNewRootPath
      },
      { type: "input", name: "groupId", message: "Maven groupId:", default: d.groupId || "" },
      { type: "input", name: "platformArtifactId", message: "Root artifactId (aggregator parent):", default: d.platformArtifactId },
      { type: "input", name: "platformVersion", message: "Platform version:", default: d.platformVersion },
      { type: "input", name: "javaVersion", message: "Java version:", default: d.javaVersion },
      { type: "input", name: "mavenMinVersion", message: "Minimum Maven version:", default: d.mavenMinVersion },
      { type: "input", name: "quarkusPlatformGroupId", message: "Quarkus platform groupId:", default: d.quarkusPlatformGroupId },
      { type: "input", name: "quarkusPlatformArtifactId", message: "Quarkus platform artifactId:", default: d.quarkusPlatformArtifactId },
      { type: "input", name: "quarkusPlatformVersion", message: "Quarkus platform version:", default: d.quarkusPlatformVersion },
      {
        type: "input",
        name: "mandrelBuilderImage",
        message: "Mandrel builder image (Quarkus native container build):",
        default: (a) => d.mandrelBuilderImage.replace(/java\d+$/, `java${a.javaVersion || d.javaVersion}`)
      },
      { type: "input", name: "enforcerVersion", message: "maven-enforcer-plugin version:", default: d.enforcerVersion },
      { type: "input", name: "surefireVersion", message: "maven-surefire-plugin version:", default: d.surefireVersion },
      { type: "input", name: "spotlessVersion", message: "spotless-maven-plugin version:", default: d.spotlessVersion },
      { type: "input", name: "checkstyleVersion", message: "maven-checkstyle-plugin version:", default: d.checkstyleVersion },
      { type: "input", name: "spotbugsVersion", message: "spotbugs-maven-plugin version:", default: d.spotbugsVersion },
      { type: "input", name: "archunitVersion", message: "archunit-junit5 version:", default: d.archunitVersion },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: true
      },
      {
        type: "confirm",
        name: "addPlatformCore",
        message: "Add platform-core libs (contract + infrastructure + eventbus-inmemory)?",
        default: true
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const wfDir = path.join(rootDir, ".github", "workflows");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");
      const rootPomPath = path.join(rootDir, "pom.xml");

      answers.corePackage ||= answers.groupId ? `${answers.groupId}.platform.core` : undefined;
      answers.coreContractArtifactId ||= "platform-core-contract";
      answers.coreInfrastructureArtifactId ||= "platform-core-infrastructure";
      answers.coreEventbusInMemoryArtifactId ||= "platform-core-eventbus-inmemory";

      const actions = [
        async () => {
          await fs.ensureDir(rootDir);
          if (await fs.pathExists(path.join(rootDir, "pom.xml"))) throw new Error(`pom.xml already exists: ${rootDir}`);

          answers.enforcerVersion ||= d.enforcerVersion;
          answers.surefireVersion ||= d.surefireVersion;
          answers.spotlessVersion ||= d.spotlessVersion;
          answers.checkstyleVersion ||= d.checkstyleVersion;
          answers.spotbugsVersion ||= d.spotbugsVersion;
          answers.archunitVersion ||= d.archunitVersion;
          answers.mavenMinVersion ||= d.mavenMinVersion;
          answers.quarkusPlatformGroupId ||= d.quarkusPlatformGroupId;
          answers.quarkusPlatformArtifactId ||= d.quarkusPlatformArtifactId;
          answers.platformVersion ||= d.platformVersion;
          answers.javaVersion ||= d.javaVersion;
          answers.quarkusPlatformVersion ||= d.quarkusPlatformVersion;
          answers.mandrelBuilderImage ||= d.mandrelBuilderImage.replace(/java\d+$/, `java${answers.javaVersion || d.javaVersion}`);

          return "OK";
        },
        { type: "add", path: path.join(rootDir, "pom.xml"), templateFile: ctx.template("platform", "root.pom.xml.hbs") },
        { type: "add", path: path.join(rootDir, "bom", "pom.xml"), templateFile: ctx.template("platform", "bom.pom.xml.hbs") },
        {
          type: "add",
          path: path.join(rootDir, "platform-starter", "pom.xml"),
          templateFile: ctx.template("platform", "platform-starter.pom.xml.hbs")
        },
        { type: "add", path: path.join(rootDir, ".platform-scaffolder.json"), templateFile: ctx.template("platform", "platform-scaffolder.json.hbs") },
        { type: "add", path: path.join(rootDir, ".gitignore"), templateFile: ctx.template("platform", "gitignore.hbs") },
        {
          type: "add",
          path: path.join(rootDir, "config/checkstyle/checkstyle.xml"),
          templateFile: ctx.template("platform", "checkstyle.xml.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "config/spotbugs/exclude.xml"),
          templateFile: ctx.template("platform", "spotbugs-exclude.xml.hbs")
        },
        async (a) => {
          await fs.ensureDir(path.join(rootDir, "services"));
          await fs.ensureDir(path.join(rootDir, "libs"));

          if (!a.addWorkflows) return "Skipped workflows";
          await fs.ensureDir(wfDir);
          await fs.outputFile(path.join(wfDir, "ci.yml"), fs.readFileSync(ctx.template("workflows", "ci.yml.hbs"), "utf8"), { flag: "wx" }).catch(() => {});
          await fs.outputFile(path.join(wfDir, "publish-ghcr.yml"), fs.readFileSync(ctx.template("workflows", "publish-ghcr.yml.hbs"), "utf8"), { flag: "wx" }).catch(() => {});
          return "Added workflows (if absent)";
        }
      ];

      if (answers.addPlatformCore) {
        const contractDir = path.join(rootDir, "libs", answers.coreContractArtifactId);
        const infraDir = path.join(rootDir, "libs", answers.coreInfrastructureArtifactId);
        const ebDir = path.join(rootDir, "libs", answers.coreEventbusInMemoryArtifactId);

        actions.push(
          { type: "add", path: path.join(contractDir, "pom.xml"), templateFile: ctx.template("rev6a", "core", "contract", "pom.xml.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/result/Result.java"), templateFile: ctx.template("rev6a", "core", "contract", "result", "Result.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/result/Success.java"), templateFile: ctx.template("rev6a", "core", "contract", "result", "Success.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/result/Failure.java"), templateFile: ctx.template("rev6a", "core", "contract", "result", "Failure.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/error/ErrorCategory.java"), templateFile: ctx.template("rev6a", "core", "contract", "error", "ErrorCategory.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/error/ErrorDetails.java"), templateFile: ctx.template("rev6a", "core", "contract", "error", "ErrorDetails.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/error/Error.java"), templateFile: ctx.template("rev6a", "core", "contract", "error", "Error.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/event/EventMetadata.java"), templateFile: ctx.template("rev6a", "core", "contract", "event", "EventMetadata.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/event/EventEnvelope.java"), templateFile: ctx.template("rev6a", "core", "contract", "event", "EventEnvelope.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/event/EventPublisherPort.java"), templateFile: ctx.template("rev6a", "core", "contract", "event", "EventPublisherPort.java.hbs") },
          { type: "add", path: path.join(contractDir, "src/main/java/{{javaPackagePath corePackage}}/contract/event/EventSubscriberPort.java"), templateFile: ctx.template("rev6a", "core", "contract", "event", "EventSubscriberPort.java.hbs") },

          { type: "add", path: path.join(infraDir, "pom.xml"), templateFile: ctx.template("rev6a", "core", "infrastructure", "pom.xml.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/http/ResultHttpRenderer.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "http", "ResultHttpRenderer.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/http/CorrelationIdFilter.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "http", "CorrelationIdFilter.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/http/GlobalThrowableRenderer.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "http", "GlobalThrowableRenderer.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/http/ValidationErrorRenderer.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "http", "ValidationErrorRenderer.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/strategy/NamedStrategy.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "strategy", "NamedStrategy.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/strategy/StrategyNotFoundError.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "strategy", "StrategyNotFoundError.java.hbs") },
          { type: "add", path: path.join(infraDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/strategy/StrategySelectorSupport.java"), templateFile: ctx.template("rev6a", "core", "infrastructure", "strategy", "StrategySelectorSupport.java.hbs") },

          { type: "add", path: path.join(ebDir, "pom.xml"), templateFile: ctx.template("rev6a", "core", "eventbus-inmemory", "pom.xml.hbs") },
          { type: "add", path: path.join(ebDir, "src/main/java/{{javaPackagePath corePackage}}/infrastructure/eventbus/inmemory/InMemoryEventBusAdapter.java"), templateFile: ctx.template("rev6a", "core", "eventbus-inmemory", "InMemoryEventBusAdapter.java.hbs") },

          async () => {
            // After files exist, register modules + BOM entries idempotently
            await utils.insertModuleIfMissing(rootPomPath, path.posix.join("libs", answers.coreContractArtifactId));
            await utils.insertModuleIfMissing(rootPomPath, path.posix.join("libs", answers.coreInfrastructureArtifactId));
            await utils.insertModuleIfMissing(rootPomPath, path.posix.join("libs", answers.coreEventbusInMemoryArtifactId));
            await utils.insertBomDependencyIfMissing({ bomPomPath: bomPomPath, groupId: answers.groupId, artifactId: answers.coreContractArtifactId, versionExpr: "${project.version}" });
            await utils.insertBomDependencyIfMissing({ bomPomPath: bomPomPath, groupId: answers.groupId, artifactId: answers.coreInfrastructureArtifactId, versionExpr: "${project.version}" });
            await utils.insertBomDependencyIfMissing({ bomPomPath: bomPomPath, groupId: answers.groupId, artifactId: answers.coreEventbusInMemoryArtifactId, versionExpr: "${project.version}" });
            return "Registered platform-core modules and BOM deps";
          }
        );
      }

      return actions;
    }
  });
};

module.exports = { registerPlatformGenerator };
