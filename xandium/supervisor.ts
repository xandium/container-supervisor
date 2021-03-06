import * as WebSocket from "ws";
import * as dotenv from "dotenv";
import { spawn, ChildProcessWithoutNullStreams, exec } from "child_process";
import * as fs from "fs";
import * as utils from "./utils";

export class Supervisor {
  websocket: WebSocket;
  botProcess: ChildProcessWithoutNullStreams;
  botActive: boolean;
  xanToken: string;
  userId: string;
  botId: string;
  password: string;
  managerIP: string;
  runCommand: string;
  runArgs: Array<string>;
  lockExists: boolean;

  constructor() {}

  async run() {
    dotenv.config();

    this.botActive = false;
    this.lockExists = fs.existsSync("manager.lock");

    this.openWebsocket();
  }

  openWebsocket() {
    this.websocket = new WebSocket("ws://localhost:8000");

    this.websocket.on("open", () => {
      this.websocket.send(
        `login ${process.env.AMQP_USER} ${process.env.AMQP_BOTUSER} ${process.env.AMQP_PASS}`
      );
    });

    this.websocket.on("message", (message: string) =>
      this.processMessage(message)
    );

    this.websocket.on("close", (code: number, reason: string) => {
      console.log(`Websocket close: code: ${code} - reason: ${reason}`);
      this.websocket.removeAllListeners();
      setTimeout(() => {
        this.openWebsocket();
      }, 1000);
    });

    this.websocket.on("error", (code: number, reason: string) => {
      console.log(`Websocket error: code: ${code} - reason: ${reason}`);
      this.websocket.removeAllListeners();
      setTimeout(() => {
        this.openWebsocket();
      }, 1000);
    });
  }

  async stopBot() {
    if (this.botActive) {
      this.botProcess.kill();
      this.botActive = false;
      this.botProcess.removeAllListeners();
      this.botProcess.unref();
      this.botProcess = undefined;
    }
  }

  async startBot() {
    try {
      this.botProcess = spawn(this.runCommand, this.runArgs);
    } catch (err) {
      console.log(`Error starting bot: ${err}`);
      this.websocket.send(`log Error starting bot: ${err}`);
      return;
    }

    this.botActive = true;

    this.botProcess.stdout.on("data", data => {
      console.log(`stdout: ${data}`);
    });

    this.botProcess.stderr.on("data", data => {
      console.error(`stderr: ${data}`);
    });

    this.botProcess.on("exit", code => {
      console.log(`child process exited with code ${code}`);
      this.botActive = false;
      this.botProcess.removeAllListeners();
      this.botProcess.unref();
      this.botProcess = undefined;
    });
  }

  async processMessage(message: string) {
    let tokens: Array<string> = message.split(" ");
    let command: string = tokens.shift();
    console.log(message);

    if (command === "OK") {
      if (!fs.existsSync("manager.lock")) {
        this.websocket.send("pullall");
      }
    } else if (command === "ERROR") {
      console.log(`MGR> Error over websocket - ${tokens.join(" ")}`);
      process.exit();
    } else if (command === "command") {
      this.runCommand = tokens.shift();
      this.runArgs = tokens;
    } else if (command === "kill") {
      process.exit();
    } else if (command === "stop") {
      if (this.botActive) {
        //kill bot
        this.botProcess.kill();
      }
    } else if (command === "mkdir") {
      fs.mkdir(tokens[0], () => {});
    } else if (command === "rmdir") {
      fs.rmdir(tokens[0], () => {});
    } else if (command === "update") {
      let file: string = tokens[0];
      let code: string = utils.btoa(tokens[1]);

      fs.writeFileSync(file, code);
    } else if (command === "delete") {
      fs.unlinkSync(tokens[0]);
    } else if (command === "reload") {
      await this.stopBot();
      await this.startBot();
    } else if (command === "restart") {
      this.botProcess.kill();
      process.exit();
    } else if (command === "status") {
      if (this.botActive) {
        this.websocket.send("running");
      } else {
        this.websocket.send("offline");
      }
    } else if (command === "start") {
      this.startBot();
    } else if (command === "execute") {
      exec(tokens.join(" "));
    } else if (command === "pullend") {
      fs.writeFileSync("manager.lock", "");
    }
  }
}
