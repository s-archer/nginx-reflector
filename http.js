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
            align-items: center; /* Center vertically */
            height: 100vh; /* Full viewport height */
            text-align: left;
        }
        .wrapper {
            display: flex;
            flex-direction: column; /* Stack items vertically */
            align-items: center; /* Center items horizontally */
        }
        .home-icon {
            margin-bottom: 20px; /* Add space below home icon */
        }
        .home-icon img {
            width: 32px;
            height: 32px;
        }
        .container {
            text-align: center; /* Ensure text is centered in the container */
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="home-icon">
            <a href="https://mydomain.com/">
                <img src="/images/home-icon.png" alt="Home">
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