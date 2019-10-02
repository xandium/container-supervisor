//require("dotenv").config({ path: ".env" });
import * as crypto from "crypto";
import * as ws from "ws";
import * as fs from "fs";
import { Supervisor } from "./supervisor";

const supervisor = new Supervisor();

(async () => {
  supervisor.run();
})();

// use ip of bot to verify against deployment/pod for authorization of manager to ensure it never loses sync
