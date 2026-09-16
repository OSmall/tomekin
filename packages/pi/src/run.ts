import {launchTomekinPi} from "./launcher";

const exitCode = await launchTomekinPi(process.cwd());
process.exitCode = exitCode;
