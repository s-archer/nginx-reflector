function kvAccess(r) {
    var headers = `${r.variables.time_iso8601} client=${r.remoteAddress} method=${r.method} uri=${r.uri} status=${r.status}`;
    r.rawHeadersIn.forEach(h => headers += ` in.${h[0]}=${h[1]}`);
    return headers;
}

export default { kvAccess }