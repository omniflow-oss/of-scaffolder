const path = require("path");
const fs = require("fs-extra");

const ensureService = async ({ svcDir }) => {
  if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
  return "OK";
};

const registerGoldenGenerators = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("module", {
    description: "Rev6A: add a module container under module/<module>/ (package regrouping only)",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service):", validate: validators.validateJavaPackage },
      { type: "input", name: "moduleName", message: "Module name (package), e.g. identity, profile:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));
      const moduleDir = path.join(javaRoot, "module", answers.moduleName);

      return [
        async () => ensureService({ svcDir }),
        { type: "add", path: path.join(moduleDir, ".gitkeep"), templateFile: ctx.template("rev6a", "service", "gitkeep.hbs") }
      ];
    }
  });

  plop.setGenerator("endpoint", {
    description: "Rev6A: create a new screen endpoint as an independent usecase skeleton",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service):", validate: validators.validateJavaPackage },
      { type: "input", name: "moduleName", message: "Module name (package), e.g. profile, wallet:", validate: validators.validateJavaIdentifier },
      { type: "input", name: "endpointName", message: "Endpoint name (kebab/word), e.g. getprofile, tenantsettings:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));

      const usecaseName = answers.endpointName;
      answers.usecasePascal = utils.toPascalCase(usecaseName);
      answers.usecaseKebab = utils.toKebab(usecaseName);
      answers.usecasePackage = `${utils.toJavaPackageSafe(usecaseName)}usecase`;

      const base = path.join(javaRoot, "module", answers.moduleName, answers.usecasePackage);

      return [
        async () => ensureService({ svcDir }),
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

  plop.setGenerator("connector", {
    description: "Rev6A: add a connector extension point inside a usecase (port + strategies + selector)",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service):", validate: validators.validateJavaPackage },
      { type: "input", name: "moduleName", message: "Module name (package):", validate: validators.validateJavaIdentifier },
      { type: "input", name: "usecaseName", message: "Usecase name (kebab/word), e.g. login, getprofile:", validate: validators.validateJavaIdentifier },
      { type: "input", name: "connectorName", message: "Connector name (kebab/word), e.g. stripe, salesforce:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));

      const usecasePackage = `${utils.toJavaPackageSafe(answers.usecaseName)}usecase`;
      const base = path.join(javaRoot, "module", answers.moduleName, usecasePackage);

      answers.usecasePascal = utils.toPascalCase(answers.usecaseName);
      answers.usecaseKebab = utils.toKebab(answers.usecaseName);
      answers.usecasePackage = usecasePackage;
      answers.connectorPascal = utils.toPascalCase(answers.connectorName);
      answers.connectorKebab = utils.toKebab(answers.connectorName);
      answers.connectorSafe = utils.toJavaPackageSafe(answers.connectorName);

      return [
        async () => ensureService({ svcDir }),
        { type: "add", path: path.join(base, "domain/config/{{usecasePascal}}ConfigurationKeys.java"), templateFile: ctx.template("rev6a", "golden", "connector", "UseCaseConfigurationKeys.java.hbs") },
        { type: "add", path: path.join(base, "domain/port/{{connectorPascal}}ClientPort.java"), templateFile: ctx.template("rev6a", "golden", "connector", "ConnectorPort.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/external/{{connectorPascal}}HttpClientAdapter.java"), templateFile: ctx.template("rev6a", "golden", "connector", "ConnectorHttpAdapter.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/external/{{connectorPascal}}InMemoryClientAdapter.java"), templateFile: ctx.template("rev6a", "golden", "connector", "ConnectorInMemoryAdapter.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/strategy/{{connectorPascal}}ClientSelector.java"), templateFile: ctx.template("rev6a", "golden", "connector", "ConnectorSelector.java.hbs") }
      ];
    }
  });

  plop.setGenerator("projection", {
    description: "Rev6A: add a data projection skeleton inside a usecase (domain + port + persistence adapter)",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service):", validate: validators.validateJavaPackage },
      { type: "input", name: "moduleName", message: "Module name (package):", validate: validators.validateJavaIdentifier },
      { type: "input", name: "usecaseName", message: "Usecase name (kebab/word):", validate: validators.validateJavaIdentifier },
      { type: "input", name: "projectionName", message: "Projection name (kebab/word), e.g. customer, usage:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));

      const usecasePackage = `${utils.toJavaPackageSafe(answers.usecaseName)}usecase`;
      const base = path.join(javaRoot, "module", answers.moduleName, usecasePackage);

      answers.usecasePascal = utils.toPascalCase(answers.usecaseName);
      answers.usecasePackage = usecasePackage;
      answers.projectionPascal = utils.toPascalCase(answers.projectionName);

      return [
        async () => ensureService({ svcDir }),
        { type: "add", path: path.join(base, "domain/projection/{{projectionPascal}}Projection.java"), templateFile: ctx.template("rev6a", "golden", "projection", "Projection.java.hbs") },
        { type: "add", path: path.join(base, "domain/port/{{projectionPascal}}ProjectionRepositoryPort.java"), templateFile: ctx.template("rev6a", "golden", "projection", "ProjectionRepositoryPort.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{projectionPascal}}ProjectionEntity.java"), templateFile: ctx.template("rev6a", "golden", "projection", "ProjectionEntity.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{projectionPascal}}ProjectionPersistenceMapper.java"), templateFile: ctx.template("rev6a", "golden", "projection", "ProjectionPersistenceMapper.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{projectionPascal}}ProjectionRepositoryAdapter.java"), templateFile: ctx.template("rev6a", "golden", "projection", "ProjectionRepositoryAdapter.java.hbs") }
      ];
    }
  });
};

module.exports = { registerGoldenGenerators };
