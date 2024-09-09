function foo(r) {
    r.log("hello from foo() handler");
    return "foo";
}

function summary(r) {
    var a, s, h;

    s = "JS summary<br><br>";

    s += "Method: " + r.method + "<br>";
    s += "HTTP version: " + r.httpVersion + "<br>";
    s += "Host: " + r.headersIn.host + "<br>";
    s += "Remote Address: " + r.remoteAddress + "<br>";
    s += "URI: " + r.uri + "<br>";

    s += "Headers:<br>";
    for (h in r.headersIn) {
        s += "  header '" + h + "' is '" + r.headersIn[h] + "'<br>";
    }

    s += "Args:<br>";
    for (a in r.args) {
        s += "  arg '" + a + "' is '" + r.args[a] + "'<br>";
    }

    return s;
}


function redirect(r) {
    // Get the incoming Host header
    const hostname = r.headersIn["Host"];

    // Set the Location header to the new URL
    r.headersOut['Location'] = `https://reflect.archf5.com/redirected`;

    // Return the 301 status code for a permanent redirect
    r.return(302);
}


function generateHtml(title, bodyText) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f0f8ff;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .container {
                text-align: center;
                background-color: #fff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            h1 {
                color: #333;
                font-size: 3rem;
                margin: 0;
            }
            p {
                color: #666;
                font-size: 1.2rem;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="home-icon">
            <a href="https://reflect.archf5.com/">
                <img src="/home.png" alt="Home">
            </a>
        </div>
        <div class="container">
            <h1>${title}</h1>
            <p>${bodyText}</p>
        </div>
    </body>
    </html>
    `;
}

function path_rule(r) {
    let title, bodyText;

    // Check the URI to determine the content
    if (r.uri === "/hello") {
        title = "Hello Page";
        bodyText = "Welcome to the Hello Page!";
    } else if (r.uri === "/redirected") {
        title = "Redirected Page";
        bodyText = "You have been redirected here.";
    } else if (r.uri === "/summary") {
        title = "Summary of Headers Received";
        bodyText = summary(r);
    }     else {
        title = "Unknown Page";
        bodyText = "This page is not recognized.";
    }

    // Set the correct Content-Type header
    r.headersOut['Content-Type'] = 'text/html';

    // Return the dynamically generated HTML
    r.return(200, generateHtml(title, bodyText));
}

// since 0.7.0
async function hash(r) {
    let hash = await crypto.subtle.digest('SHA-512', r.headersIn.host);
    r.setReturnValue(Buffer.from(hash).toString('hex'));
}

export default {summary, hash, path_rule, generateHtml, redirect};