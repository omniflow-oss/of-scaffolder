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

  const defaultGroupId = (rootDir) => {
    const cfg = readRepoConfigSync(rootDir);
    return cfg.groupId;
  };

  const defaultServiceFlags = (rootDir) => {
    const cfg = readRepoConfigSync(rootDir);
    return {
      addWorkflows: cfg?.defaults?.service?.addWorkflows ?? false,
      registerInRootPom: cfg?.defaults?.service?.registerInRootPom ?? true,
      internalLibs: Array.isArray(cfg?.defaults?.service?.internalLibs) ? cfg.defaults.service.internalLibs : [],
      dockerBaseImage: cfg?.defaults?.service?.dockerBaseImage,
      quarkusExtensions: Array.isArray(cfg?.defaults?.service?.quarkusExtensions) ? cfg.defaults.service.quarkusExtensions : [],
      testDependencies: Array.isArray(cfg?.defaults?.service?.testDependencies) ? cfg.defaults.service.testDependencies : []
    };
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
    listInternalLibs,
    defaultGroupId,
    defaultServiceFlags,
    defaultLibFlags
  };
};

module.exports = { createContext };
