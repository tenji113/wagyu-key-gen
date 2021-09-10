import { executeCommandSync } from "./ExecuteCommand";
import { execSync } from 'child_process';
import { mkdir, existsSync, access, constants } from 'fs';
import { Network } from '../types'
import { cwd } from 'process';

import path from "path";
import process from "process";

const ETH2_DEPOSIT_DIR_NAME = "eth2.0-deposit-cli-1.2.0";

const ETH2_DEPOSIT_CLI_PATH = path.join("src", "vendors", ETH2_DEPOSIT_DIR_NAME);
const SCRIPTS_PATH = path.join("src", "scripts");

const REQUIREMENTS_PATH = path.join(ETH2_DEPOSIT_CLI_PATH, "requirements.txt");
const WORD_LIST_PATH = path.join(ETH2_DEPOSIT_CLI_PATH, "eth2deposit", "key_handling", "key_derivation", "word_lists");

const REQUIREMENT_PACKAGES_PATH = path.join("dist", "packages");

const ETH2DEPOSIT_PROXY_PATH = path.join(SCRIPTS_PATH, "eth2deposit_proxy.py");

const SFE_PATH = path.join("dist", "bin", "eth2deposit_proxy" + (process.platform == "win32" ? ".exe" : ""));
const DIST_WORD_LIST_PATH = path.join(cwd(), "dist", "word_lists");

const CREATE_MNEMONIC_SUBCOMMAND = "create_mnemonic";
const GENERATE_KEYS_SUBCOMMAND = "generate_keys";

const PYTHON_EXE = (process.platform == "win32" ? "python" : "python3");

const requireDepositPackages = (): boolean => {

  if (!existsSync(REQUIREMENT_PACKAGES_PATH)) {
    mkdir(REQUIREMENT_PACKAGES_PATH, { recursive: true }, (err) => {
      if (err) throw err;
    });

    return executeCommandSync(PYTHON_EXE + " -m pip install -r " +
      REQUIREMENTS_PATH + " --target " + REQUIREMENT_PACKAGES_PATH) == 0;
  } else {
      return true;
  }
}

const singleFileExecutableExists = (): boolean => {
  access(SFE_PATH, constants.F_OK, (err) => {
    return false;
  });
  return true;
}

const createMnemonic = (language: string): string => {
  let cmd = "";
  let env = process.env;

  const escapedLanguage = escapeArgument(language);

  if(singleFileExecutableExists()) {
    cmd = SFE_PATH + " " + CREATE_MNEMONIC_SUBCOMMAND + " " + DIST_WORD_LIST_PATH + " --language " + escapedLanguage;
    console.log('Calling SFE for create mnemonic with cmd = ' + cmd);
  } else {
    if(!requireDepositPackages()) {
      return '';
    }
  
    const pythonpath = executeCommandSync(PYTHON_EXE + " -c \"import sys;print(':'.join(sys.path))\"");
  
    const expythonpath = REQUIREMENT_PACKAGES_PATH + ":" + ETH2_DEPOSIT_CLI_PATH + ":" + pythonpath;
  
    env.PYTHONPATH = expythonpath;
  
    cmd = PYTHON_EXE + " " + ETH2DEPOSIT_PROXY_PATH + " " + CREATE_MNEMONIC_SUBCOMMAND + " " + WORD_LIST_PATH + " --language " + escapedLanguage;
  }

  try {
    const result = JSON.parse(execSync(cmd, {env: env}).toString())
    return result.mnemonic;
  } 
  catch (error) {
    // TODO: more robust error handling
    error.status;
    error.message;
    error.stderr;
    error.stdout;
    console.log(error.message);
    return error.status;
  }

}

const escapeArgument = (argument: string): string => {
  if (process.platform == "win32") {
    // TODO: Escape argument for Windows properly
    if (/ /.test(argument)) {
      return "\"" + argument + "\"";
    }
    return argument;
  } else {
    if (argument === '') return '\'\'';
    if (!/[^%+,-./:=@_0-9A-Za-z]/.test(argument)) return argument;
    return '\'' + argument.replace(/'/g, '\'"\'') + '\'';
  }
}

const generateKeys = (
    mnemonic: string,
    index: number,
    count: number,
    network: Network,
    password: string,
    eth1_withdrawal_address: string,
    folder: string,
  ): boolean => {
  if(!requireDepositPackages()) {
    return false;
  }

  let cmd = "";
  let env = process.env;

  let withdrawalAddress: string = "";
  if (eth1_withdrawal_address != "") {
    withdrawalAddress = `--eth1_withdrawal_address ${eth1_withdrawal_address}`;
  }
  
  const escapedPassword = escapeArgument(password);
  const escapedMnemonic = escapeArgument(mnemonic);
  
  if(singleFileExecutableExists()) {
    cmd = `${SFE_PATH} ${GENERATE_KEYS_SUBCOMMAND} ${withdrawalAddress}${escapedMnemonic} ${index} ${count} ${folder} ${network.toLowerCase()} ${escapedPassword}`;
    console.log('Calling SFE for generate keys');
  } else {
    if(!requireDepositPackages()) {
      return false;
    }
  
    const pythonpath = executeCommandSync(PYTHON_EXE + " -c \"import sys;print(':'.join(sys.path))\"");

    const expythonpath = REQUIREMENT_PACKAGES_PATH + ":" + ETH2_DEPOSIT_CLI_PATH + ":" + pythonpath;
    
    env.PYTHONPATH = expythonpath;

    cmd = `${PYTHON_EXE} ${ETH2DEPOSIT_PROXY_PATH} ${GENERATE_KEYS_SUBCOMMAND} ${withdrawalAddress}${escapedMnemonic} ${index} ${count} ${folder} ${network.toLowerCase()} ${escapedPassword}`;
  }
  
  try {
    execSync(cmd, {env: env});
    return true;
  } 
  catch (error) {
    // TODO: more robust error handling
    error.status;
    error.message;
    error.stderr;
    error.stdout;
    console.log(error.message);
    return false;
  }
}

export {
  createMnemonic,
  generateKeys
};