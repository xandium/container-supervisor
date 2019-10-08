import { Supervisor } from "./supervisor";

const supervisor = new Supervisor();

(async () => {
  supervisor.run();
})();

// use ip of bot to verify against deployment/pod for authorization of manager to ensure it never loses sync
