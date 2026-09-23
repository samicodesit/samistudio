const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, "..");
config.watchFolders = [repositoryRoot];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules"), path.resolve(repositoryRoot, "node_modules")];

module.exports = config;
