import * as WebSocket from "ws";
import * as dotenv from "dotenv";
import { spawn, ChildProcessWithoutNullStreams, exec } from "child_process";
import * as fs from "fs";
import * as crypto from "crypto";

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
      this.openWebsocket();
    });

    this.websocket.on("error", (code: number, reason: string) => {
      console.log(`Websocket error: code: ${code} - reason: ${reason}`);
      this.websocket.removeAllListeners();
      this.openWebsocket();
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
    this.botProcess = spawn(this.runCommand, this.runArgs);

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
      let code: string = this.btoa(tokens[1]);

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
    }
  }

  btoa(str: string): string {
    return Buffer.from(str, "base64").toString("ascii");
  }

  atob(str: string): string {
    return Buffer.from(str, "ascii").toString("base64");
  }
}
