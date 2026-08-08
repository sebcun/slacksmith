export function renderHomePage(title: string): string {
    return `<!doctype html>
<html lang="en">

    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
    </head>

    <body>
        <main>
            <h1>${title}</h1>
            <p>Local SlackSmith server is running.</p>
        </main>
    </body>

</html>
`
}