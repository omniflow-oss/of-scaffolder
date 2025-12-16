const path = require("path");

const validators = require("./src/validators.cjs");
const utils = require("./src/utils.cjs");
const { createContext } = require("./src/scaffolder/context.cjs");

const { registerPlatformGenerator } = require("./src/generators/platform.cjs");
const { registerLibGenerator } = require("./src/generators/lib.cjs");
const { registerEventBusGenerator } = require("./src/generators/eventbus.cjs");
const { registerUseCaseGenerator } = require("./src/generators/usecase.cjs");
const { registerModulesGenerator } = require("./src/generators/modules.cjs");

module.exports = function (plop) {
  plop.setWelcomeMessage("Platform scaffolder (Quarkus/Maven/Graal native/GitHub Actions)");

  plop.setHelper("kebab", (s) => utils.toKebab(s));
  plop.setHelper("nowIsoDate", () => utils.nowIsoDate());
  plop.setHelper("javaPackagePath", (s) => utils.javaPackageToPath(s));
  plop.setHelper("pascal", (s) => utils.toPascalCase(s));
  plop.setHelper("camel", (s) => utils.toCamelCase(s));

  const ctx = createContext({ plopfileDir: __dirname });
  const deps = { plop, ctx, validators, utils };

  registerPlatformGenerator(deps);
  registerLibGenerator(deps);
  registerUseCaseGenerator(deps);
  registerModulesGenerator(deps);
  registerEventBusGenerator(deps);
};
