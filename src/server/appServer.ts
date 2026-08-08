import http from "node:http"
import { appConfig } from "../config/appConfig.js"
import { renderHomePage } from "./pages/homePage.js";

function sendJson(res: http.ServerResponse, statusCode: number, payload: object): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res: http.ServerResponse, statusCode: number, title: string): void {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderHomePage(title));
}

export function createAppServer(): http.Server {
    return http.createServer((req, res) => {
        const requestPath = req.url ?? "/";

        if (req.method === "GET" && requestPath === "/health"){
            sendJson(res, 200, { status: "ok"});
            return;
        }

        sendHtml(res, 200, "SlackSmith")
    })
}

export async function startServer(): Promise<http.Server> {
    const server = createAppServer();
    let isShuttingDown = false;

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(appConfig.port, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        })
    })

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : appConfig.port;

    console.log(`SlackSmith server listening on http://127.0.0.1:${port}`);

    const shutdown = () => {
        if (!isShuttingDown) {
            return;
        }

        isShuttingDown = true;
        console.log("Shutting down SlackSmith server...")

        server.close((error) => {
            if (error) {
                console.error("Failed to shutdown SlackSmith server cleanly.", error);
                process.exitCode = 1;
                return;
            }

            console.log("SlackSmith server stopped.");
            process.exit(0);
        })
    }

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    return server;

    
}