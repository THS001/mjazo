// Metro for an app in the mobile/ workspace: it sees the shared package, and looks for packages
// only in this workspace (never in the website's node_modules above it).
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const root = path.resolve(__dirname, "../..")
const config = getDefaultConfig(__dirname)
config.watchFolders = [root]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules"), path.resolve(root, "node_modules")]
config.resolver.disableHierarchicalLookup = true
module.exports = config
