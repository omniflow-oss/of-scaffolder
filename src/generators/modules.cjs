const path = require("path");
const fs = require("fs-extra");

const registerModulesGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("modules", {
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
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        { type: "add", path: path.join(moduleDir, ".gitkeep"), templateFile: ctx.template("rev6a", "_common", "gitkeep.hbs") }
      ];
    }
  });
};

module.exports = { registerModulesGenerator };
