const path = require("path");
const { realpathSync } = require("node:fs");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, "..");
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules"), path.resolve(repositoryRoot, "node_modules")];
// Worktrees may share dependencies through symlinks. Metro must see their targets.
config.watchFolders = [...new Set([repositoryRoot, ...config.resolver.nodeModulesPaths.map(folder => realpathSync(folder))])];

module.exports = config;

