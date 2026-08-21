import { initBotId } from "botid/client/core";

initBotId({ protect: [{ path: "/api/generate", method: "POST" }] });
