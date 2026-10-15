const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, "..");
const modulePaths = [path.resolve(__dirname, "node_modules"), path.resolve(repositoryRoot, "node_modules")];
const physicalModulePaths = modulePaths.filter(fs.existsSync).map(modulePath => fs.realpathSync(modulePath));
// Metro must also watch the target when a worktree reuses installed dependencies.
config.watchFolders = [...new Set([repositoryRoot, ...physicalModulePaths])];
config.resolver.nodeModulesPaths = [...new Set([...modulePaths, ...physicalModulePaths])];

module.exports = config;

