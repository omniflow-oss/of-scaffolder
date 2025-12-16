const path = require("path");
const fs = require("fs-extra");

const createContext = ({ plopfileDir }) => {
  const template = (...parts) => path.join(plopfileDir, "templates", ...parts);

  const readRepoConfigSync = (rootDir) => {
    try {
      const configPath = path.join(rootDir, ".platform-scaffolder.json");
      if (!fs.pathExistsSync(configPath)) return {};
      return fs.readJsonSync(configPath) || {};
    } catch {
      return {};
    }
  };

  const defaultGroupId = (rootDir) => {
    const cfg = readRepoConfigSync(rootDir);
    return cfg.groupId;
  };

  const defaultLibFlags = (rootDir) => {
    const cfg = readRepoConfigSync(rootDir);
    return {
      registerInRootPom: cfg?.defaults?.lib?.registerInRootPom ?? true,
      registerInBom: cfg?.defaults?.lib?.registerInBom ?? true,
      testDependencies: Array.isArray(cfg?.defaults?.lib?.testDependencies) ? cfg.defaults.lib.testDependencies : []
    };
  };

  return {
    template,
    readRepoConfigSync,
    defaultGroupId,
    defaultLibFlags
  };
};

module.exports = { createContext };
