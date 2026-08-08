const DEFAULT_PORT = 3000;

function parsePort(value: string | undefined): number {
    if (!value) {
        return DEFAULT_PORT;
    }

    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
        return DEFAULT_PORT;
    }

    return parsed;
}

export interface AppConfig {
    port: number;
    environment: string;
}

export const appConfig: AppConfig = {
    port: parsePort(process.env.PORT),
    environment: process.env.NODE_ENV ?? "development"
}