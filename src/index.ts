import { appConfig } from "./config/appConfig.js"

function bootstrap(): void {
    console.log("SlackSmith Initialized.");
    console.log(`Configured Port: ${appConfig.port}`);
}

bootstrap();