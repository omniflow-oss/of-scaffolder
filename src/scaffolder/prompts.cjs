const path = require("path");
const { toJavaPackageSafe } = require("../utils.cjs");

const baseRepoPrompts = ({ validateRootPath, defaultRootDir = "../.." }) => [
  {
    type: "input",
    name: "rootDir",
    message: "Repo root directory (absolute or relative):",
    default: defaultRootDir,
    validate: validateRootPath
  }
];

const groupIdPrompt = ({ ctx }) => ({
  type: "input",
  name: "groupId",
  message: "Maven groupId:",
  default: (a) => {
    const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
    return ctx.defaultGroupId(rootDir) || "";
  }
});

const basePackagePromptFor = ({ validateJavaPackage, nameKey }) => ({
  type: "input",
  name: "basePackage",
  message: "Base Java package:",
  validate: validateJavaPackage,
  default: (a) => `${a.groupId}.${toJavaPackageSafe(a[nameKey])}`
});

module.exports = { baseRepoPrompts, groupIdPrompt, basePackagePromptFor };
