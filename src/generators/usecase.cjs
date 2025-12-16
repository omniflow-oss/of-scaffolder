const path = require("path");
const fs = require("fs-extra");

const registerUseCaseGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("usecase", {
    description: "Add a Rev6A usecase skeleton under module/<module>/<usecase>/ inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service), e.g. com.yourcompany.yourapp:", validate: validators.validateJavaPackage },
      { type: "input", name: "moduleName", message: "Module name (package), e.g. identity, profile:", validate: validators.validateJavaIdentifier },
      { type: "input", name: "usecaseName", message: "Usecase name (kebab/word), e.g. login, issueotp:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const svcPomPath = path.join(svcDir, "pom.xml");
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));
      const testJavaRoot = path.join(svcDir, "src/test/java", utils.javaPackageToPath(answers.rootPackage));

      answers.usecasePascal = utils.toPascalCase(answers.usecaseName);
      answers.usecaseKebab = utils.toKebab(answers.usecaseName);
      answers.usecasePackage = `${utils.toJavaPackageSafe(answers.usecaseName)}usecase`;

      const base = path.join(javaRoot, "module", answers.moduleName, answers.usecasePackage);

      const writeTemplateIfAbsent = async (destPath, templatePath) => {
        const content = fs.readFileSync(templatePath, "utf8");
        const rendered = plop.renderString(content, answers);
        return utils.writeIfAbsent(destPath, rendered);
      };

      const ensureDependenciesSection = async () => {
        const xml = await fs.readFile(svcPomPath, "utf8");
        if (xml.includes("<dependencies>") && xml.includes("</dependencies>")) return false;
        const idx = xml.lastIndexOf("</project>");
        if (idx === -1) throw new Error(`Invalid pom.xml (missing </project>): ${svcPomPath}`);
        const insertion = [
          "  <dependencies>",
          "  </dependencies>",
          ""
        ].join("\n");
        await fs.writeFile(svcPomPath, xml.slice(0, idx) + insertion + xml.slice(idx));
        return true;
      };

      const ensureUsecasePomDeps = async () => {
        const cfg = ctx.readRepoConfigSync(rootDir);
        const deps = cfg?.defaults?.usecase?.pom?.dependencies;
        const testDeps = cfg?.defaults?.usecase?.pom?.testDependencies;
        if (!Array.isArray(deps) || deps.length === 0) {
          throw new Error(`Missing defaults.usecase.pom.dependencies in ${path.join(rootDir, ".platform-scaffolder.json")}`);
        }
        if (!Array.isArray(testDeps) || testDeps.length === 0) {
          throw new Error(`Missing defaults.usecase.pom.testDependencies in ${path.join(rootDir, ".platform-scaffolder.json")}`);
        }

        await ensureDependenciesSection();

        for (const dep of deps) {
          await utils.insertPomDependencyIfMissing({
            pomPath: svcPomPath,
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            versionExpr: dep.version,
            scope: dep.scope
          });
        }
        for (const dep of testDeps) {
          await utils.insertPomDependencyIfMissing({
            pomPath: svcPomPath,
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            versionExpr: dep.version,
            scope: dep.scope || "test"
          });
        }
      };

      return [
        async () => {
          if (!(await fs.pathExists(svcPomPath))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },

        async () => ensureUsecasePomDeps().then(() => "Ensured service pom deps"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "boot/Application.java"), ctx.template("rev6a", "boot", "Application.java.hbs")).then(() => "Bootstrapped boot/Application (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "boot/Wiring.java"), ctx.template("rev6a", "boot", "Wiring.java.hbs")).then(() => "Bootstrapped boot/Wiring (if absent)"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/result/Result.java"), ctx.template("rev6a", "shared", "contract", "result", "Result.java.hbs")).then(() => "Bootstrapped shared Result (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/result/Success.java"), ctx.template("rev6a", "shared", "contract", "result", "Success.java.hbs")).then(() => "Bootstrapped shared Success (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/result/Failure.java"), ctx.template("rev6a", "shared", "contract", "result", "Failure.java.hbs")).then(() => "Bootstrapped shared Failure (if absent)"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/error/Error.java"), ctx.template("rev6a", "shared", "contract", "error", "Error.java.hbs")).then(() => "Bootstrapped shared Error (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/error/ErrorCategory.java"), ctx.template("rev6a", "shared", "contract", "error", "ErrorCategory.java.hbs")).then(() => "Bootstrapped shared ErrorCategory (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/contract/error/ErrorDetails.java"), ctx.template("rev6a", "shared", "contract", "error", "ErrorDetails.java.hbs")).then(() => "Bootstrapped shared ErrorDetails (if absent)"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/http/ResultHttpRenderer.java"), ctx.template("rev6a", "shared", "infrastructure", "http", "ResultHttpRenderer.java.hbs")).then(() => "Bootstrapped ResultHttpRenderer (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/http/GlobalThrowableRenderer.java"), ctx.template("rev6a", "shared", "infrastructure", "http", "GlobalThrowableRenderer.java.hbs")).then(() => "Bootstrapped GlobalThrowableRenderer (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/http/CorrelationIdFilter.java"), ctx.template("rev6a", "shared", "infrastructure", "http", "CorrelationIdFilter.java.hbs")).then(() => "Bootstrapped CorrelationIdFilter (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/http/ValidationErrorRenderer.java"), ctx.template("rev6a", "shared", "infrastructure", "http", "ValidationErrorRenderer.java.hbs")).then(() => "Bootstrapped ValidationErrorRenderer (if absent)"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/strategy/NamedStrategy.java"), ctx.template("rev6a", "shared", "infrastructure", "strategy", "NamedStrategy.java.hbs")).then(() => "Bootstrapped NamedStrategy (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/strategy/StrategyNotFoundError.java"), ctx.template("rev6a", "shared", "infrastructure", "strategy", "StrategyNotFoundError.java.hbs")).then(() => "Bootstrapped StrategyNotFoundError (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "shared/infrastructure/strategy/StrategySelectorSupport.java"), ctx.template("rev6a", "shared", "infrastructure", "strategy", "StrategySelectorSupport.java.hbs")).then(() => "Bootstrapped StrategySelectorSupport (if absent)"),

        async () => writeTemplateIfAbsent(path.join(testJavaRoot, "Rev6AArchitectureTest.java"), ctx.template("rev6a", "test", "Rev6AArchitectureTest.java.hbs")).then(() => "Bootstrapped Rev6AArchitectureTest (if absent)"),

        { type: "add", path: path.join(base, "api/{{usecasePascal}}Resource.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "UseCaseResource.java.hbs") },
        { type: "add", path: path.join(base, "api/request/{{usecasePascal}}Request.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "request", "UseCaseRequest.java.hbs") },
        { type: "add", path: path.join(base, "api/response/{{usecasePascal}}Response.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "response", "UseCaseResponse.java.hbs") },
        { type: "add", path: path.join(base, "application/{{usecasePascal}}Service.java"), templateFile: ctx.template("rev6a", "module", "usecase", "application", "UseCaseService.java.hbs") },
        { type: "add", path: path.join(base, "domain/{{usecasePascal}}Model.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "UseCaseModel.java.hbs") },
        { type: "add", path: path.join(base, "domain/port/{{usecasePascal}}RepositoryPort.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "port", "UseCaseRepositoryPort.java.hbs") },
        { type: "add", path: path.join(base, "domain/error/{{usecasePascal}}ErrorCodes.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "error", "UseCaseErrorCodes.java.hbs") },
        { type: "add", path: path.join(base, "domain/error/{{usecasePascal}}ErrorFactory.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "error", "UseCaseErrorFactory.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}Entity.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCaseEntity.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}PersistenceMapper.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCasePersistenceMapper.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}RepositoryAdapter.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCaseRepositoryAdapter.java.hbs") }
      ];
    }
  });
};

module.exports = { registerUseCaseGenerator };
