import { SN, Sinc } from "@sincronia/types";
import inquirer from "inquirer";
import { getAppList, getManifestWithFiles } from "./server";
import { DEFAULT_CONFIG_FILE, manifest, config_path, env_path } from "./config";
import AppManager from "./AppManager";
import fs from "fs";
const fsp = fs.promises;
import { logger } from "./Logger";
import path from "path";

export async function startWizard() {
  let loginAnswers = await getLoginInfo();
  await setupDotEnv(loginAnswers);
  let hasConfig = await checkConfig();
  if (!hasConfig) {
    logger.info("Generating config...");
    await writeDefaultConfig();
  }
  let man = await manifest;
  if (!man) {
    let selectedApp = await showAppList(loginAnswers);
    if (!selectedApp) {
      return;
    }
    logger.info("Downloading app...");
    await downloadApp(loginAnswers, selectedApp);
  }
  logger.success(
    "You are all set up 👍 Try running 'npx sinc dev' to begin development mode."
  );
}

async function getLoginInfo(): Promise<Sinc.LoginAnswers> {
  return await inquirer.prompt([
    {
      type: "input",
      name: "instance",
      message:
        "What instance would you like to connect to?(ex. test123.service-now.com)"
    },
    {
      type: "input",
      name: "username",
      message: "What is your username on that instance?"
    },
    {
      type: "password",
      name: "password",
      message: "What is your password on that instance?"
    }
  ]);
}

async function checkConfig(): Promise<boolean> {
  try {
    if (!config_path) {
      return false;
    }
    await fsp.access(config_path, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

async function setupDotEnv(answers: Sinc.LoginAnswers) {
  let data = `SN_USER=${answers.username}
SN_PASSWORD=${answers.password}
SN_INSTANCE=${answers.instance}
  `;
  process.env.SN_USER = answers.username;
  process.env.SN_PASSWORD = answers.password;
  process.env.SN_INSTANCE = answers.instance;
  try {
    await fsp.writeFile(env_path, data);
  } catch (e) {
    throw e;
  }
}

async function writeDefaultConfig() {
  try {
    let pth = config_path || path.join(process.cwd(), "sinc.config.js");
    if (pth) {
      await fsp.writeFile(pth, DEFAULT_CONFIG_FILE);
    }
  } catch (e) {
    throw e;
  }
}

async function showAppList(
  answers: Sinc.LoginAnswers
): Promise<string | undefined> {
  let { username: user, password, instance } = answers;
  let apps: SN.App[] = [];
  try {
    apps = await getAppList({ user, password, instance });
  } catch (e) {
    logger.error(
      "Failed to get application list. Check to see that your credentials are correct and you have the update set installed on your instance."
    );
    return;
  }
  let appSelection: Sinc.AppSelectionAnswer = await inquirer.prompt([
    {
      type: "list",
      name: "app",
      message: "Which app would you like to work with?",
      choices: apps.map(app => {
        return {
          name: `${app.displayName}(${app.scope})`,
          value: app.scope,
          short: app.displayName
        };
      })
    }
  ]);
  return appSelection.app;
}

async function downloadApp(answers: Sinc.LoginAnswers, scope: string) {
  try {
    let { username: user, password, instance } = answers;
    let man = await getManifestWithFiles(scope, { user, password, instance });
    await AppManager.processManifest(man);
  } catch (e) {
    logger.error(e.toString());
    throw new Error("Failed to download files!");
  }
}
