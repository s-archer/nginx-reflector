// Combined NGINX JS (njs) script
// Includes your existing handlers and adds iRule-style test pages.
//
// r is the request object provided by NGINX.


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
    r.headersOut['Location'] = `https://reflect.archf5.com/redirected`;
    r.return(302);
}

// ----------------- Reusable HTML generator -----------------
function generateScripts() {
    return `<script>
(async function showQuotableAlert(){
  const url = "https://type.fit/api/quotes";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("Network response not OK");
    const data = await res.json();
    const text = "Unknown";
    alert("Quote of the moment" + text);
  } catch (err) {
    console.warn("Quotable fetch failed:", err);
  }
})();
</script>`
}

function generateHtml(title, bodyText, scripts) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${scripts}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0; 
            padding: 0;
            background-image: url('reflection.jpg');
            background-size: cover;
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

// ----------------- Existing path rules -----------------
function path_rule(r) {
    let title, bodyText, scripts;

    // Check the URI to determine the content
    scripts = "";

    if (r.uri === "/hello") {
        title = "Hello Page";
        bodyText = "Welcome to the Hello Page!";
    } else if (r.uri === "/redirected") {
        title = "Redirected Page";
        bodyText = "You have been redirected here.";
    } else if (r.uri === "/response-headers") {
        r.headersOut['Content-Type'] = 'text/html';
        r.headersOut['Strict-Transport-Security'] = 'max-age=20000000';
        r.headersOut['Set-Cookie'] = [
            'weak-cookie=weakphrase; Path=/response-headers',
            'other-cookie=value-xyz'
        ];
        title = "Hello Page";
        bodyText = "Welcome to the Response Headers Page! Look at developer tools to see the following headers:</p>";

        // Iterate over r.headersOut and append them to the bodyText
        bodyText += "<h2>Response Headers:</h2>";
        for (const header in r.headersOut) {
            bodyText += `<p>${header}: ${r.headersOut[header]}</p>`;
        }
    } else if (r.uri === "/summary") {
        title = "Summary of Headers Received";
        bodyText = summary(r);
    // } else if (r.uri === "/scripts") {
    //     title = "Execute some scripts for CSD";
    //     bodyText = "Execute some scripts for CSD";
    //     scripts = generateScripts();
    } else {
        return iframe_rule(r); // Delegate to iRule-style handler if matched
    }

    r.headersOut['Content-Type'] = 'text/html';
    r.return(200, generateHtml(title, bodyText, scripts));
}

// ----------------- iRule-like Test Page Handler -----------------
function setCommonHeaders(r) {
    r.headersOut['Strict-Transport-Security'] = 'max-age=31536000';
    r.headersOut['Expires'] = 'Mon, 1 Jan 2001 00:00:00 GMT';
    r.headersOut['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    r.headersOut['Pragma'] = 'no-cache';
}

// Small transparent pixel for placeholders
const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P+iXyAAAAABJRU5ErkJggg==";

// function sendImage(r) {
//     setCommonHeaders(r);
//     r.headersOut['Content-Type'] = 'image/png';
//     r.return(200, Buffer.from(base64Image, 'base64'));
// }

function iframe_rule(r) {
    const path = r.uri;

    // HTML Pages
    if (path === "/index-iframe.html") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'text/html';
        const html = `
<html>
<head><meta charset="UTF-8"><title>Test Page</title></head>
<body bgcolor="Green">
<h1> iFrame </h1>
<div style="display: inline-block; margin: 10px; text-align: left;">
    <div style="margin-bottom: 4px;">iframe – http – external domain</div>
    <iframe src="http://test-only-iframe.reflect.demof5.net/iframe-http.html" width="300" height="250"></iframe>
</div>
<div style="display: inline-block; margin: 10px; text-align: left;">
    <div style="margin-bottom: 4px;">iframe – https – external domain</div>
    <iframe src="https://test-only-iframe.reflect.demof5.net/iframe-https.html" width="300" height="250"></iframe>
</div>
<div style="display: inline-block; margin: 10px; text-align: left;">
    <div style="margin-bottom: 4px;">iframe – https - sandbox external domain</div>
    <iframe sandbox src="https://test-only-iframe.reflect.demof5.net/iframe-sandbox-https.html" width="300" height="250"></iframe>
</div>
<div style="display: inline-block; margin: 10px; text-align: left;">
    <div style="margin-bottom: 4px;">iframe – https - xframes</div>
    <iframe src="https://test-only-iframe.reflect.demof5.net/xframes/xframe-https.html" width="300" height="250"></iframe>
</div>
<div style="display: inline-block; margin: 10px; text-align: left;">
    <div style="margin-bottom: 4px;">iframe – https - framebust test</div>
    <iframe src="https://test-only-iframe.reflect.demof5.net/framebust.html" width="300" height="250"></iframe>
</div>

<h1> Images </h1>
<img src="http://test-only-webbug.reflect.archf5.com/webbug-http.jpg" width="120" height="120">
<img src="https://test-only-webbug.reflect.f5xc.co.uk/webbug-https.jpg" width="120" height="120">
<img src="http://test-only.reflect.archf5.com/local-http.jpg" width="120" height="120">
<img src="https://test-only.reflect.archf5.com/local-https.jpg" width="120" height="120">
<img src="http://subdomain.test-only.reflect.archf5.com/subdomain-http.jpg" width="120" height="120">
<br><h1> Scripts </h1>
<script>
document.write('<img src="https://test-only.reflect.archf5.com/script-inline.jpg" width="120" height="120"></img>')
</script>
<script src="https://test-only-webbug.reflect.f5xc.co.uk/offdomain.js"></script>
<script src="https://test-only.reflect.archf5.com/ondomain.js"></script>
</body></html>`;
        r.return(200, html);
        return;
    }

    if (path === "/framebust.html") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'text/html';
        const html = `
<html><head><style id="antiClickjack">body{display:none !important;}</style></head>
<body style="background-color:#25DEB3">
<h1>Framebuster failed</h1>
<script src="https://test-only.reflect.archf5.com/framebust.js"></script>
</body></html>`;
        r.return(200, html);
        return;
    }

    if (path === "/iframe-http.html") {
        setCommonHeaders(r);
        r.return(200, `<html><body style="background-color:#999966"><h1>Cross-domain HTTP iframe.</h1></body></html>`);
        return;
    }

    if (path === "/iframe-https.html") {
        setCommonHeaders(r);
        r.return(200, `<html><body style="background-color:#F5DEB3"><h1>Cross-domain HTTPS iframe.</h1></body></html>`);
        return;
    }

    if (path === "/iframe-sandbox-https.html") {
        setCommonHeaders(r);
        r.return(200, `<html><body style="background-color:#15DEB3"><h1>Fully sandboxed HTTPS iframe.</h1><script src="https://test-only.reflect.archf5.com/sandbox-check.js"></script></body></html>`);
        return;
    }

    if (path === "/xframes/xframe-https.html") {
        setCommonHeaders(r);
        r.return(200, `<html><body style="background-color:#A5DEB3"><h1>Cross-domain HTTPS iframe. X-Frame-Options not supported if visible.</h1></body></html>`);
        return;
    }

    // JS endpoints
    if (path === "/framebust.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.return(200, `
if (self === top) {
  var antiClickjack = document.getElementById("antiClickjack");
  if (antiClickjack) antiClickjack.parentNode.removeChild(antiClickjack);
}`);
        return;
    }

    if (path === "/offdomain.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.return(200, `document.write('<img src="https://test-only-webbug.reflect.f5xc.co.uk/script-offdomain.jpg" width="120" height="120"></img>')`);
        return;
    }

    if (path === "/ondomain.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.return(200, `document.write('<img src="https://test-only-webbug.reflect.f5xc.co.uk/script-ondomain.jpg" width="120" height="120"></img>')`);
        return;
    }

    if (path === "/sandbox-check.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.return(200, `document.write('<img src="https://test-only-webbug.reflect.f5xc.co.uk/sandbox-check.jpg" width="120" height="120"></img>')`);
        return;
    }

    // Image endpoints (placeholders)
    const imgPaths = [
        "/local-http.jpg","/local-https.jpg","/sandbox-check.jpg","/script-inline.jpg","/script-ondomain.jpg","/script-offdomain.jpg","/subdomain-http.jpg","/webbug-http.jpg","/webbug-https.jpg","/xframes/script-inline.jpg"
    ];
    // if (imgPaths.includes(path)) {
    //     sendImage(r);
    //     return;
    // }

    // Default
    r.return(404, "Not found");
}

// ----------------- Optional: SHA hash -----------------
async function hash(r) {
    let hash = await crypto.subtle.digest('SHA-512', r.headersIn.host);
    r.setReturnValue(Buffer.from(hash).toString('hex'));
}

export default {summary, hash, path_rule, generateHtml, redirect, iframe_rule};