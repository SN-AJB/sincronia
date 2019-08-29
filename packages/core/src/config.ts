import { SN, Sinc } from "@sincronia/types";
import path from "path";
import { promises as fsp } from "fs";
// const fsp = fs.promises;
import * as logger from "./logging";
import { includes, excludes } from "./defaultManifestConfig";

export const DEFAULT_CONFIG: Sinc.Config = {
  sourceDirectory: "src",
  rules: [],
  includes,
  excludes
};

export const DEFAULT_CONFIG_FILE: string = `
module.exports = {
  sourceDirectory: "src",
  rules: [],
  excludes:{},
  includes:{}
};
`.trim();

const config_path = getConfigPath();
const root_dir = getRootDir();
export const config = _getConfig();
export const manifest = _getManifest();

async function _getConfig(): Promise<Sinc.Config> {
  try {
    let configPath = await config_path;
    if (configPath) {
      let projectConfig: Sinc.Config = (await import(configPath)).default;
      //merge in includes/excludes
      let {
        includes: pIncludes = {},
        excludes: pExcludes = {}
      } = projectConfig;
      projectConfig.includes = Object.assign(includes, pIncludes);
      projectConfig.excludes = Object.assign(excludes, pExcludes);
      return projectConfig;
    } else {
      throw new Error("Failed to find config...");
    }
  } catch (e) {
    logger.warn(e);
    logger.warn("Loading default config...");
    return DEFAULT_CONFIG;
  }
}

async function _getManifest(): Promise<SN.AppManifest | undefined> {
  try {
    let manifestString = await fsp.readFile(await getManifestPath(), "utf-8");
    return JSON.parse(manifestString);
  } catch (e) {
    return undefined;
  }
}

export async function getConfigPath(pth?: string): Promise<string | false> {
  if (!pth) {
    pth = process.cwd();
  }
  // check to see if config is found
  let files = await fsp.readdir(pth);
  if (files.includes("sinc.config.js")) {
    return path.join(pth, "sinc.config.js");
  } else {
    if (isRoot(pth)) {
      return false;
    }
    return getConfigPath(path.dirname(pth));
  }
  function isRoot(pth: string) {
    return path.parse(pth).root === pth;
  }
}

export async function getSourcePath() {
  let rootDir = await root_dir;
  let { sourceDirectory = "src" } = await config;
  return path.join(rootDir, sourceDirectory);
}

export async function getEnvPath() {
  let rootDir = await root_dir;
  return path.join(rootDir, ".env");
}

export async function getManifestPath() {
  let rootDir = await root_dir;
  return path.join(rootDir, "sinc.manifest.json");
}

export async function getRootDir() {
  let configPath = await config_path;
  let rootDir;
  if (configPath) {
    rootDir = path.dirname(configPath);
  } else {
    rootDir = process.cwd();
  }
  return rootDir;
}
