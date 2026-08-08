import { start } from "node:repl";
import { appConfig } from "./config/appConfig.js"
import { startServer } from "./server/appServer.js";

async function bootstrap(): Promise<void> {
    console.log("SlackSmith Initialized.");
    console.log(`Configured Port: ${appConfig.port}`);
    
    await startServer();
}

void bootstrap();