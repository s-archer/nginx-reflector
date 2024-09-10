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
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center; /* Center horizontally */
            align-items: flex-start; /* Align container to the top */
            min-height: 100vh; /* Ensure body takes full viewport height */
            overflow-y: auto; /* Allow vertical scrolling if content is too tall */
            text-align: center;
        }
        .wrapper {
            display: flex;
            flex-direction: column; /* Stack items vertically */
            align-items: center; /* Center items horizontally */
            max-width: 100%; /* Ensure container does not overflow horizontally */
            padding: 20px; /* Optional padding for spacing */
        }
        .home-icon {
            margin-bottom: 20px;
        }
        .home-icon img {
            width: 32px;
            height: 32px;
        }
        .container {
            text-align: center;
        }
        .container p {
            text-align: left; /* Align body text to the left */
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="home-icon">
            <a href="https://reflect.archf5.com">
                <img src="/home.png" alt="Home">
            </a>
        </div>
        <div class="container">
            <h1>${title}</h1>
            <p>${bodyText}</p>
        </div>
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
    } else {
        title = "Unknown Page";
        bodyText = "This page is not recognized.";
    }

    // Set the correct Content-Type header
    r.headersOut['Content-Type'] = 'text/html';

    if (r.uri === "/response-headers") {
        r.headersOut['Content-Type'] = 'text/html';
        r.headersOut['Strict-Transport-Security'] = 'max-age=20000000';
        r.headersOut['Set-Cookie'] = 'weak-cookie=weakphrase';
        r.headersOut['Set-Cookie'] = 'other-cookie=value-xyz';
        title = "Hello Page";
        bodyText = "Welcome to the Response Headers Page! Look at developer tools to see the following headers:</p>";

        // Iterate over r.headersOut and append them to the bodyText
        bodyText += "<h2>Response Headers:</h2>";
        for (const header in r.headersOut) {
            bodyText += `<p>${header}: ${r.headersOut[header]}</p>`;
        }
    }

    // Return the dynamically generated HTML
    r.return(200, generateHtml(title, bodyText));
}

// since 0.7.0
async function hash(r) {
    let hash = await crypto.subtle.digest('SHA-512', r.headersIn.host);
    r.setReturnValue(Buffer.from(hash).toString('hex'));
}

export default {summary, hash, path_rule, generateHtml, redirect};