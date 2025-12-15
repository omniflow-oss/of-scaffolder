const fs = require("fs-extra");

const toKebab = (s = "") =>
  String(s)
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

const toJavaPackageSafe = (s = "") => toKebab(s).replace(/-/g, "").replace(/[^a-z0-9]/g, "");

const javaPackageToPath = (pkg = "") => String(pkg || "").trim().replace(/\./g, "/");

const ensureDir = async (dir) => fs.ensureDir(dir);

const writeIfAbsent = async (file, content) => {
  const exists = await fs.pathExists(file);
  if (exists) return false;
  await fs.outputFile(file, content);
  return true;
};

const readPomCoordinates = async (pomPath) => {
  try {
    const xml = await fs.readFile(pomPath, "utf8");
    const groupId = xml.match(/<groupId>\s*([^<\s]+)\s*<\/groupId>/)?.[1];
    const artifactId = xml.match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)?.[1];
    const version = xml.match(/<version>\s*([^<\s]+)\s*<\/version>/)?.[1];
    return { groupId, artifactId, version };
  } catch {
    return { groupId: undefined, artifactId: undefined, version: undefined };
  }
};

const insertModuleIfMissing = async (rootPomPath, modulePath) => {
  const xml = await fs.readFile(rootPomPath, "utf8");
  if (xml.includes(`<module>${modulePath}</module>`)) return false;

  const markerStart = "<!-- scaffolder:modules:start -->";
  const markerEnd = "<!-- scaffolder:modules:end -->";
  const markerStartIdx = xml.indexOf(markerStart);
  const markerEndIdx = xml.indexOf(markerEnd);
  if (markerStartIdx !== -1 && markerEndIdx !== -1 && markerEndIdx > markerStartIdx) {
    const afterStart = markerStartIdx + markerStart.length;
    const between = xml.slice(afterStart, markerEndIdx);
    const indent =
      between.match(/\n(\s*)<!-- scaffolder:modules:end -->/)?.[1] ??
      xml.slice(0, markerStartIdx).match(/\n(\s*)<!-- scaffolder:modules:start -->/)?.[1] ??
      "    ";
    const insertion = `\n${indent}<module>${modulePath}</module>`;
    const updated = xml.slice(0, markerEndIdx) + insertion + xml.slice(markerEndIdx);
    await fs.writeFile(rootPomPath, updated);
    return true;
  }

  const modulesStart = xml.indexOf("<modules>");
  const modulesEnd = xml.indexOf("</modules>");
  if (modulesStart === -1 || modulesEnd === -1 || modulesEnd < modulesStart) return null;

  const between = xml.slice(modulesStart, modulesEnd);
  const indent = between.match(/\n(\s*)<module>/)?.[1] ?? "    ";
  const insertion = `${indent}<module>${modulePath}</module>\n`;

  const updated = xml.slice(0, modulesEnd) + insertion + xml.slice(modulesEnd);
  await fs.writeFile(rootPomPath, updated);
  return true;
};

const insertBomDependencyIfMissing = async ({ bomPomPath, groupId, artifactId, versionExpr }) => {
  const xml = await fs.readFile(bomPomPath, "utf8");
  const needle = `<artifactId>${artifactId}</artifactId>`;
  if (xml.includes(needle) && xml.includes(`<groupId>${groupId}</groupId>`)) return false;

  const markerStart = "<!-- scaffolder:deps:start -->";
  const markerEnd = "<!-- scaffolder:deps:end -->";
  const markerStartIdx = xml.indexOf(markerStart);
  const markerEndIdx = xml.indexOf(markerEnd);

  const dep = (depIndent) => {
    const lineIndent = depIndent + "  ";
    return [
      `${depIndent}<dependency>`,
      `${lineIndent}<groupId>${groupId}</groupId>`,
      `${lineIndent}<artifactId>${artifactId}</artifactId>`,
      `${lineIndent}<version>${versionExpr}</version>`,
      `${depIndent}</dependency>`,
      ""
    ].join("\n");
  };

  if (markerStartIdx !== -1 && markerEndIdx !== -1 && markerEndIdx > markerStartIdx) {
    const afterStart = markerStartIdx + markerStart.length;
    const between = xml.slice(afterStart, markerEndIdx);
    const depIndent =
      between.match(/\n(\s*)<!-- scaffolder:deps:end -->/)?.[1] ??
      xml.slice(0, markerStartIdx).match(/\n(\s*)<!-- scaffolder:deps:start -->/)?.[1] ??
      "      ";
    const insertion = `\n${dep(depIndent)}`;
    const updated = xml.slice(0, markerEndIdx) + insertion + xml.slice(markerEndIdx);
    await fs.writeFile(bomPomPath, updated);
    return true;
  }

  const dmStart = xml.indexOf("<dependencyManagement>");
  if (dmStart === -1) return null;
  const depsStart = xml.indexOf("<dependencies>", dmStart);
  if (depsStart === -1) return null;
  const depsEnd = xml.indexOf("</dependencies>", depsStart);
  if (depsEnd === -1) return null;

  const between = xml.slice(depsStart, depsEnd);
  const depIndent = between.match(/\n(\s*)<dependency>/)?.[1] ?? "      ";

  const updated = xml.slice(0, depsEnd) + dep(depIndent) + xml.slice(depsEnd);
  await fs.writeFile(bomPomPath, updated);
  return true;
};

const nowIsoDate = () => new Date().toISOString().slice(0, 10);

module.exports = {
  toKebab,
  toJavaPackageSafe,
  javaPackageToPath,
  ensureDir,
  writeIfAbsent,
  readPomCoordinates,
  insertModuleIfMissing,
  insertBomDependencyIfMissing,
  nowIsoDate
};
