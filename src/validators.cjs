const fs = require("fs-extra");
const path = require("path");

const validateArtifactId = (v) => {
  const s = String(v || "").trim();
  if (!s) return "Required";
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(s)) return "Use kebab-case: a-z, 0-9, '-' (must start with a letter)";
  if (s.includes("--")) return "Avoid double dashes";
  return true;
};

const validateJavaPackage = (v) => {
  const s = String(v || "").trim();
  if (!s) return "Required";
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(s)) return "Invalid Java package (lowercase dotted), e.g. com.acme.myservice";
  return true;
};

const validateRootPath = async (v) => {
  const p = path.resolve(process.cwd(), v || "");
  const pom = path.join(p, "pom.xml");
  if (!(await fs.pathExists(pom))) return `No pom.xml found at: ${p}`;
  return true;
};

const validateNewRootPath = async (v) => {
  const p = path.resolve(process.cwd(), v || "");
  const pom = path.join(p, "pom.xml");
  if (await fs.pathExists(pom)) return `pom.xml already exists at: ${p}`;
  return true;
};

module.exports = { validateArtifactId, validateJavaPackage, validateRootPath, validateNewRootPath };
