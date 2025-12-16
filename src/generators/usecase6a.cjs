const path = require("path");
const fs = require("fs-extra");

const registerUseCase6aGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("usecase6a", {
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
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));

      answers.usecasePascal = utils.toPascalCase(answers.usecaseName);
      answers.usecaseKebab = utils.toKebab(answers.usecaseName);
      answers.usecasePackage = `${utils.toJavaPackageSafe(answers.usecaseName)}usecase`;

      const base = path.join(javaRoot, "module", answers.moduleName, answers.usecasePackage);

      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
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

module.exports = { registerUseCase6aGenerator };

