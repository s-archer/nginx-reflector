// Combined NGINX JS (njs) script
// Includes your existing handlers and adds iRule-style test pages.
//
// r is the request object provided by NGINX.

const WAITING_ROOM_ID_COOKIE = "wr_id";
const WAITING_ROOM_ADMIT_COOKIE = "wr_admit";
const WAITING_ROOM_TARGET_PREFIX = "/queue-demo";
const WAITING_ROOM_ACTIVE_SLOTS = 1;
const WAITING_ROOM_ADMIT_TTL_MS = 2 * 60 * 1000;
const WAITING_ROOM_STALE_MS = 10 * 60 * 1000;
const waitingRoomState = {
    entries: {},
    queue: []
};

function nowMs() {
    return Date.now();
}

function parseCookies(r) {
    const cookieHeader = r.headersIn.Cookie || r.headersIn.cookie || "";
    const result = {};

    cookieHeader.split(";").forEach(function (part) {
        const trimmed = part.trim();
        if (!trimmed) {
            return;
        }

        const eq = trimmed.indexOf("=");
        if (eq === -1) {
            result[trimmed] = "";
            return;
        }

        const name = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        result[name] = decodeURIComponent(value);
    });

    return result;
}

function appendSetCookie(r, value) {
    const existing = r.headersOut["Set-Cookie"];
    if (!existing) {
        r.headersOut["Set-Cookie"] = [value];
        return;
    }

    if (Array.isArray(existing)) {
        r.headersOut["Set-Cookie"] = existing.concat(value);
        return;
    }

    r.headersOut["Set-Cookie"] = [existing, value];
}

function setCookie(r, name, value, maxAgeSeconds) {
    let cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Secure`;
    if (maxAgeSeconds !== undefined && maxAgeSeconds !== null) {
        cookie += `; Max-Age=${maxAgeSeconds}`;
    }
    if (name === WAITING_ROOM_ADMIT_COOKIE) {
        cookie += "; HttpOnly";
    }
    appendSetCookie(r, cookie);
}

function clearCookie(r, name) {
    appendSetCookie(r, `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`);
}

function createClientId() {
    return `wr-${nowMs().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseTarget(target) {
    if (!target || target.indexOf(WAITING_ROOM_TARGET_PREFIX) !== 0) {
        return WAITING_ROOM_TARGET_PREFIX;
    }
    return target;
}

function queuePosition(id) {
    const index = waitingRoomState.queue.indexOf(id);
    return index === -1 ? 0 : index + 1;
}

function removeFromQueue(id) {
    waitingRoomState.queue = waitingRoomState.queue.filter(function (item) {
        return item !== id;
    });
}

function removeEntry(id) {
    removeFromQueue(id);
    delete waitingRoomState.entries[id];
}

function ensureQueued(entry) {
    if (entry.admittedUntil) {
        return;
    }
    if (waitingRoomState.queue.indexOf(entry.id) === -1) {
        waitingRoomState.queue.push(entry.id);
    }
}

function cleanupWaitingRoom() {
    const now = nowMs();

    Object.keys(waitingRoomState.entries).forEach(function (id) {
        const entry = waitingRoomState.entries[id];
        if (!entry) {
            return;
        }

        if (entry.admittedUntil && entry.admittedUntil <= now) {
            removeEntry(id);
            return;
        }

        if (!entry.admittedUntil && now - entry.lastSeen > WAITING_ROOM_STALE_MS) {
            removeEntry(id);
        }
    });

    waitingRoomState.queue = waitingRoomState.queue.filter(function (id) {
        return Boolean(waitingRoomState.entries[id]);
    });
}

function countActiveAdmissions() {
    const now = nowMs();
    return Object.keys(waitingRoomState.entries).filter(function (id) {
        const entry = waitingRoomState.entries[id];
        return Boolean(entry && entry.admittedUntil && entry.admittedUntil > now);
    }).length;
}

function promoteWaitingUsers() {
    let active = countActiveAdmissions();
    const now = nowMs();

    while (active < WAITING_ROOM_ACTIVE_SLOTS && waitingRoomState.queue.length > 0) {
        const id = waitingRoomState.queue.shift();
        const entry = waitingRoomState.entries[id];
        if (!entry) {
            continue;
        }

        entry.admittedUntil = now + WAITING_ROOM_ADMIT_TTL_MS;
        active += 1;
    }
}

function waitingRoomEntry(id, target) {
    let entry = waitingRoomState.entries[id];
    if (!entry) {
        entry = {
            id: id,
            joinedAt: nowMs(),
            lastSeen: nowMs(),
            target: target,
            admittedUntil: 0
        };
        waitingRoomState.entries[id] = entry;
    }

    entry.lastSeen = nowMs();
    entry.target = target;
    return entry;
}

function json(r, status, body) {
    r.headersOut["Content-Type"] = "application/json";
    r.headersOut["Cache-Control"] = "no-store";
    r.return(status, JSON.stringify(body));
}

function queueStatus(r) {
    cleanupWaitingRoom();

    const args = r.args || {};
    const cookies = parseCookies(r);
    const target = normaliseTarget(args.target || WAITING_ROOM_TARGET_PREFIX);
    const clientId = cookies[WAITING_ROOM_ID_COOKIE] || createClientId();

    if (!cookies[WAITING_ROOM_ID_COOKIE]) {
        setCookie(r, WAITING_ROOM_ID_COOKIE, clientId, 12 * 60 * 60);
    }

    const entry = waitingRoomEntry(clientId, target);
    ensureQueued(entry);
    promoteWaitingUsers();

    if (entry.admittedUntil && entry.admittedUntil > nowMs()) {
        removeFromQueue(clientId);
        setCookie(
            r,
            WAITING_ROOM_ADMIT_COOKIE,
            clientId,
            Math.floor(WAITING_ROOM_ADMIT_TTL_MS / 1000)
        );
        json(r, 200, {
            admitted: true,
            target: target,
            expires_at: entry.admittedUntil,
            active_slots: WAITING_ROOM_ACTIVE_SLOTS
        });
        return;
    }

    json(r, 200, {
        admitted: false,
        position: queuePosition(clientId),
        active_slots: WAITING_ROOM_ACTIVE_SLOTS,
        queue_depth: waitingRoomState.queue.length
    });
}

function queueLeave(r) {
    const cookies = parseCookies(r);
    const clientId = cookies[WAITING_ROOM_ID_COOKIE];

    if (clientId) {
        removeEntry(clientId);
    }

    clearCookie(r, WAITING_ROOM_ID_COOKIE);
    clearCookie(r, WAITING_ROOM_ADMIT_COOKIE);
    json(r, 200, {
        left: true
    });
}

function queueDemo(r) {
    cleanupWaitingRoom();

    const cookies = parseCookies(r);
    const clientId = cookies[WAITING_ROOM_ID_COOKIE];
    const admitCookie = cookies[WAITING_ROOM_ADMIT_COOKIE];
    const entry = clientId ? waitingRoomState.entries[clientId] : null;

    if (!clientId || !admitCookie || admitCookie !== clientId || !entry || !entry.admittedUntil || entry.admittedUntil <= nowMs()) {
        clearCookie(r, WAITING_ROOM_ADMIT_COOKIE);
        r.headersOut["Location"] = WAITING_ROOM_TARGET_PREFIX;
        r.return(302, "");
        return;
    }

    entry.lastSeen = nowMs();
    r.headersOut["Content-Type"] = "text/html";
    r.return(200, generateHtml(
        "Queue Demo",
        "You have been admitted through the waiting room. This demo slot stays active for a short time, then the next queued visitor can be admitted. Use the leave link below to free the slot immediately.<br><br><a href=\"/queue/leave-page\">Leave the demo and release my slot</a>",
        ""
    ));
}

function queueLeavePage(r) {
    const cookies = parseCookies(r);
    const clientId = cookies[WAITING_ROOM_ID_COOKIE];
    if (clientId) {
        removeEntry(clientId);
    }

    clearCookie(r, WAITING_ROOM_ID_COOKIE);
    clearCookie(r, WAITING_ROOM_ADMIT_COOKIE);
    r.headersOut["Location"] = WAITING_ROOM_TARGET_PREFIX;
    r.return(302, "");
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
    r.headersOut['Location'] = `https://reflect.archf5.com/redirected`;
    r.log("Returning response for URI: " + r.uri);
    r.return(302);
}

// ----------------- Reusable HTML generator -----------------
// function generateScripts() {
//     return `<script>
// (async function showQuotableAlert(){
//   const url = "https://type.fit/api/quotes";
//   try {
//     const res = await fetch(url, { cache: "no-store" });
//     if(!res.ok) throw new Error("Network response not OK");
//     const data = await res.json();
//     const text = "Unknown";
//     alert("Quote of the moment" + text);
//   } catch (err) {
//     console.warn("Quotable fetch failed:", err);
//   }
// })();
// </script>`
// }

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
    } else if (r.uri === WAITING_ROOM_TARGET_PREFIX) {
        return queueDemo(r);
    } else if (r.uri === "/output-headers" || r.uri === "/waf-bypass") {

        const args = r.args || {};
        const sizeParam = args.size ? parseInt(args.size, 10) : null;
        const includeAttack =
            args["include-attack"] === "true" ||
            args.include_attack === "true" ||
            args["attack-enable"] === "true" ||
            args.attack_enable === "true";
        const position = args.position === "start" ? "start" : "end";
        const includeFixedCookies = args["fixed-cookies"] !== "false";
        const attack = "<script>alert('xss')</script>";

        function headerWireBytes(name, value) {
            return Buffer.byteLength(name + ": " + value + "\r\n");
        }

        function buildValueExact(size, attackText, shouldIncludeAttack, attackPosition) {
            if (!Number.isInteger(size) || size < 1) {
                return null;
            }

            if (!shouldIncludeAttack) {
                return "A".repeat(size);
            }

            const attackBytes = Buffer.byteLength(attackText);
            if (size < attackBytes) {
                return null;
            }

            const filler = "A".repeat(size - attackBytes);
            return attackPosition === "start" ? attackText + filler : filler + attackText;
        }

        const cookies = [];
        if (includeFixedCookies) {
            cookies.push("weak-cookie=weakphrase; Path=/");
            cookies.push("other-cookie=value-xyz");
        }

        let oversizedValue = "";
        if (sizeParam !== null) {
            oversizedValue = buildValueExact(sizeParam, attack, includeAttack, position);
            if (oversizedValue === null) {
                r.headersOut["Content-Type"] = "text/plain";
                r.return(400, "invalid size");
                return;
            }
            cookies.push(`oversized-cookie=${oversizedValue}; Path=/`);
        }

        cookies.forEach(c => r.headersOut["Set-Cookie"] = c);

        const oversizedCookieLine = cookies.length > 0 ? cookies[cookies.length - 1] : "";
        const totalSetCookieBytes = cookies.reduce(
            (sum, cookie) => sum + headerWireBytes("Set-Cookie", cookie),
            0
        );

        r.headersOut["X-Test-Fixed-Cookies"] = includeFixedCookies ? "true" : "false";
        r.headersOut["X-Test-Attack-Included"] = includeAttack ? "true" : "false";
        r.headersOut["X-Test-Attack-Position"] = includeAttack ? position : "none";
        r.headersOut["X-Test-Cookie-Value-Bytes"] = String(Buffer.byteLength(oversizedValue));
        r.headersOut["X-Test-Oversized-Set-Cookie-Bytes"] = oversizedCookieLine
            ? String(headerWireBytes("Set-Cookie", oversizedCookieLine))
            : "0";
        r.headersOut["X-Test-Total-Set-Cookie-Bytes"] = String(totalSetCookieBytes);
        r.headersOut["Content-Type"] = "text/plain";
        r.log("Returning response for URI: " + r.uri);
        r.return(200, "Welcome to the Output Headers Page!");
        return;
    } else if (r.uri === "/summary") {
        title = "Summary of Headers Received";
        bodyText = summary(r);
    } else if (r.uri === "/output-body") {
        const args = r.args || {};
        const sizeParam = args.size ? parseInt(args.size, 10) : 0;
        r.log("Returning response for URI: " + r.uri);
        r.return(200, "A".repeat(sizeParam));
    } else {
        return iframe_rule(r); // Delegate to iRule-style handler if matched
    }

    r.headersOut['Content-Type'] = 'text/html';
    r.log("Returning response for URI: " + r.uri);
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
// const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P+iXyAAAAABJRU5ErkJggg==";

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
                <div style="margin-bottom: 4px;">Cross-domain HTTP iframe.</div>
                <iframe src="http://test-only-iframe.reflect.demof5.net/iframe-http.html" width="300" height="250"></iframe>
            </div>
            <div style="display: inline-block; margin: 10px; text-align: left;">
                <div style="margin-bottom: 4px;">Cross-domain HTTPS iframe.</div>
                <iframe src="https://test-only-iframe.reflect.demof5.net/iframe-https.html" width="300" height="250"></iframe>
            </div>
            <div style="display: inline-block; margin: 10px; text-align: left;">
                <div style="margin-bottom: 4px;">Fully sandboxed HTTPS iframe.</div>
                <iframe sandbox src="https://test-only-iframe.reflect.demof5.net/iframe-sandbox-https.html" width="300" height="250"></iframe>
            </div>
            <div style="display: inline-block; margin: 10px; text-align: left;">
                <div style="margin-bottom: 4px;">Cross-domain HTTPS iframe. X-Frame-Options not supported if visible.</div>
                <iframe src="https://test-only-iframe.reflect.demof5.net/xframes/xframe-https.html" width="300" height="250"></iframe>
            </div>
            <div style="display: inline-block; margin: 10px; text-align: left;">
                <div style="margin-bottom: 4px;">framebust test</div>
                <iframe src="https://test-only-iframe.reflect.demof5.net/framebust.html" width="300" height="250"></iframe>
            </div>

            <h1> Images </h1>
            <img src="http://test-only-webbug.reflect.f5xc.co.uk/webbug-http.jpg" width="120" height="120">
            <img src="https://test-only-webbug.reflect.f5xc.co.uk/webbug-https.jpg" width="120" height="120">
            <img src="http://reflect.archf5.com/local-http.jpg" width="120" height="120">
            <img src="https://reflect.archf5.com/local-https.jpg" width="120" height="120">
            <img src="http://subdomain.reflect.archf5.com/subdomain-http.jpg" width="120" height="120">
            <br><h1> Scripts </h1>
            <script>document.write('<img src="https://reflect.archf5.com/script-inline.jpg" width="120" height="120"></img>')</script>
            <script src="https://test-only-webbug.reflect.f5xc.co.uk/offdomain.js"></script>
            <script src="https://reflect.archf5.com/ondomain.js"></script>
            </body></html>`;
        r.log("Returning response for URI: " + r.uri);
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
            <script src="https://test-only.reflect.demof5.net/framebust.js"></script>
            </body></html>`;
        r.log("Returning response for URI: " + r.uri);
        r.return(200, html);
        return;
    }

    if (path === "/iframe-http.html") {
        setCommonHeaders(r);
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `<html><body style="background-color:#999966"><h1>Cross-domain HTTP iframe.</h1></body></html>`);
        return;
    }

    if (path === "/iframe-https.html") {
        setCommonHeaders(r);
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `<html><body style="background-color:#F5DEB3"><h1>Cross-domain HTTPS iframe.</h1></body></html>`);
        return;
    }

    if (path === "/iframe-sandbox-https.html") {
        setCommonHeaders(r);
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `<html><body style="background-color:#15DEB3"><h1>Fully sandboxed HTTPS iframe.</h1><h1>Script Blocked.</h1><script src="https://reflect.archf5.com/sandbox-check.js"></script></body></html>`);
        return;
    }

    if (path === "/xframes/xframe-https.html") {
        setCommonHeaders(r);
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `<html><body style="background-color:#A5DEB3"><h1>Cross-domain HTTPS iframe. X-Frame-Options not supported if visible.</h1></body></html>`);
        return;
    }

    // JS endpoints
    if (path === "/framebust.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.log("Returning response for URI: " + r.uri);
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
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `document.write('<img src="https://test-only-webbug.reflect.f5xc.co.uk/script-offdomain.jpg" width="120" height="120"></img>')`);
        return;
    }

    if (path === "/ondomain.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.log("Returning response for URI: " + r.uri);
        r.return(200, `document.write('<img src="https://test-only-webbug.reflect.archf5.com/script-ondomain.jpg" width="120" height="120"></img>')`);
        return;
    }

    if (path === "/sandbox-check.js") {
        setCommonHeaders(r);
        r.headersOut['Content-Type'] = 'application/javascript';
        r.log("Returning response for URI: " + r.uri);
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
    r.log("Returning response for URI: " + r.uri);
    r.return(404, "Not found");
}

// ----------------- Optional: SHA hash -----------------
async function hash(r) {
    let hash = await crypto.subtle.digest('SHA-512', r.headersIn.host);
    r.setReturnValue(Buffer.from(hash).toString('hex'));
}

// // =========================
// // BODY TESTS
// // =========================

// function echo_body(r) {
//     const args = r.args || {};
//     const size = parseInt(args.size || "0", 10);

//     r.headersOut['Content-Type'] = 'text/plain';
//     r.return(200, "A".repeat(size));
// }

// // =========================
// // HEADER TESTS
// // =========================

// function echo_headers(r) {
//     const args = r.args || {};
//     const size = parseInt(args.size || "0", 10);

//     r.headersOut['X-Test-Size'] = String(size);

//     let headers = [];
//     const chunk = "A".repeat(1024);
//     const count = Math.ceil(size / 1024);

//     for (let i = 0; i < count; i++) {
//         r.headersOut["X-C" + i] = chunk;
//         headers.push("X-C" + i);
//     }

//     r.return(200, JSON.stringify({
//         generated_headers: headers.length
//     }));
// }

// // =========================
// // COOKIE TESTS
// // =========================

// function echo_cookies(r) {
//     const args = r.args || {};
//     const size = parseInt(args.size || "0", 10);

//     let cookies = [];
//     const chunk = "A".repeat(1024);
//     const count = Math.ceil(size / 1024);

//     for (let i = 0; i < count; i++) {
//         cookies.push(`c${i}=${chunk}; Path=/`);
//     }

//     r.headersOut['Set-Cookie'] = cookies;

//     r.return(200, JSON.stringify({
//         cookies: cookies.length
//     }));
// }

// // =========================
// // WAF TEST ENDPOINTS
// // =========================

// function waf_body(r) {
//     const size = parseInt((r.args || {}).size || "0", 10);
//     const attack = (r.args || {}).attack === "1";

//     const payload = attack
//         ? "<script>alert('xss')</script>"
//         : "";

//     const base = Math.max(0, size - payload.length);

//     r.headersOut['Content-Type'] = 'text/plain';
//     r.return(200, "A".repeat(base) + payload);
// }

// function waf_headers(r) {
//     const attack = (r.args || {}).attack === "1";

//     if (attack) {
//         r.headersOut["X-Test"] = "<script>alert('xss')</script>";
//     } else {
//         r.headersOut["X-Test"] = "safe";
//     }

//     r.return(200, "OK");
// }

// function waf_cookies(r) {
//     const attack = (r.args || {}).attack === "1";

//     if (attack) {
//         r.headersOut['Set-Cookie'] =
//             "test=<script>alert('xss')</script>; Path=/";
//     } else {
//         r.headersOut['Set-Cookie'] =
//             "test=safe; Path=/";
//     }

//     r.return(200, "OK");
// }

// function waf_reflect(r) {
//     const attack = (r.args || {}).attack === "1"
//         ? "<script>alert('xss')</script>"
//         : "safe";

//     r.return(200, attack);
// }

export default {
    summary,
    queueStatus,
    queueLeave,
    queueDemo,
    queueLeavePage,
    // echo_body,
    // echo_headers,
    // echo_cookies,
    // waf_body,
    // waf_headers,
    // waf_cookies,
    // waf_reflect,
    hash, 
    path_rule, 
    generateHtml, 
    redirect, 
    iframe_rule
};
