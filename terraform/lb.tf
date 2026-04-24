resource "volterra_http_loadbalancer" "nginx-reflector" {
  name        = "nginx-reflector"
  namespace   = var.xc_namespace
  description = "NGINX Reflector Load-Balancer"
  domains     = [var.xc_lb_domain]

  advertise_on_public_default_vip = true

  https_auto_cert {
    port                  = 443
    add_hsts              = true
    http_redirect         = true
    no_mtls               = true
    default_header        = true
    enable_path_normalize = true

    tls_config {
      default_security = true
    }
  }

  app_firewall {
    namespace = "shared"
    name      = "arch-shared-waf"
  }

  default_route_pools {
    pool {
      namespace = var.xc_namespace
      name      = volterra_origin_pool.nginx-reflector.name
    }
  }

  routes {
    direct_response_route {
      http_method = "ANY"

      path {
        prefix = "/queue-demo"
      }

      headers {
        name         = "Cookie"
        regex        = ".*wr_admit=.*"
        invert_match = true
      }

      route_direct_response {
        response_code = 200
        response_body = <<-HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>F5 Waiting Room</title>
  <style>
    :root {
      --f5-red: #e4002b;
      --ink: #161616;
      --mist: #f4f1ea;
      --line: rgba(22,22,22,0.12);
      --card: rgba(255,255,255,0.84);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(228,0,43,0.22), transparent 30%),
        linear-gradient(135deg, #fff8ef 0%, #f5f0e6 55%, #ece4d7 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .panel {
      width: min(760px, 100%);
      background: var(--card);
      backdrop-filter: blur(16px);
      border: 1px solid var(--line);
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(22,22,22,0.14);
    }
    .hero {
      padding: 28px 28px 20px;
      background: linear-gradient(135deg, var(--ink), #2d2d2d 70%, #4c4c4c);
      color: #fff;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
    }
    .brand-mark {
      width: 14px;
      height: 14px;
      background: var(--f5-red);
      border-radius: 3px;
      display: inline-block;
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.6rem);
      line-height: 0.95;
      max-width: 10ch;
    }
    .hero p {
      margin: 16px 0 0;
      max-width: 52ch;
      color: rgba(255,255,255,0.8);
      line-height: 1.55;
    }
    .body {
      padding: 28px;
      display: grid;
      gap: 18px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
      background: rgba(255,255,255,0.7);
    }
    .stat-label {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(22,22,22,0.58);
      margin-bottom: 10px;
    }
    .stat-value {
      font-size: clamp(1.6rem, 3vw, 2.5rem);
      font-weight: 700;
    }
    .status {
      border-radius: 18px;
      border: 1px solid var(--line);
      padding: 18px;
      background: rgba(255,255,255,0.65);
      line-height: 1.6;
    }
    .pulse {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--f5-red);
      box-shadow: 0 0 0 rgba(228,0,43,0.4);
      animation: pulse 1.8s infinite;
      margin-right: 10px;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(228,0,43,0.35); }
      70% { box-shadow: 0 0 0 12px rgba(228,0,43,0); }
      100% { box-shadow: 0 0 0 0 rgba(228,0,43,0); }
    }
    .footnote {
      font-size: 13px;
      color: rgba(22,22,22,0.6);
    }
  </style>
</head>
<body>
  <main class="panel">
    <section class="hero">
      <div class="brand"><span class="brand-mark"></span> F5 Waiting Room</div>
      <h1>Please hold while we admit visitors in turn.</h1>
      <p>This waiting room is protecting a limited-capacity destination. Keep this tab open and we will move you forward automatically when your slot becomes available.</p>
    </section>
    <section class="body">
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Your Position</div>
          <div class="stat-value" id="position">-</div>
        </div>
        <div class="stat">
          <div class="stat-label">Active Slots</div>
          <div class="stat-value" id="slots">-</div>
        </div>
        <div class="stat">
          <div class="stat-label">Queue Depth</div>
          <div class="stat-value" id="depth">-</div>
        </div>
      </div>
      <div class="status" id="status">
        <span class="pulse"></span>Contacting the queue service...
      </div>
      <div class="footnote">
        Admission is granted by the origin-hosted queue API and persisted in a short-lived cookie. Once admitted, you will be redirected automatically.
      </div>
    </section>
  </main>
  <script>
    const target = window.location.pathname + window.location.search;
    const statusEl = document.getElementById("status");
    const positionEl = document.getElementById("position");
    const slotsEl = document.getElementById("slots");
    const depthEl = document.getElementById("depth");

    async function pollQueue() {
      try {
        const response = await fetch("/queue/api/status?target=" + encodeURIComponent(target), {
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Queue API returned " + response.status);
        }

        const data = await response.json();
        slotsEl.textContent = data.active_slots ?? "-";

        if (data.admitted) {
          positionEl.textContent = "0";
          depthEl.textContent = "0";
          statusEl.innerHTML = "<span class=\"pulse\"></span>Your slot is ready. Redirecting you now...";
          window.location.replace(data.target || target);
          return;
        }

        positionEl.textContent = String(data.position ?? "-");
        depthEl.textContent = String(data.queue_depth ?? "-");
        statusEl.innerHTML = "<span class=\"pulse\"></span>You are still in the waiting room. We will refresh your place automatically.";
      } catch (error) {
        statusEl.innerHTML = "<span class=\"pulse\"></span>We could not refresh your queue status. Retrying...";
      }

      window.setTimeout(pollQueue, 3000);
    }

    pollQueue();
  </script>
</body>
</html>
HTML
      }

      response_headers_to_add {
        name   = "Content-Type"
        value  = "text/html; charset=UTF-8"
        append = false
      }

      response_headers_to_add {
        name   = "Cache-Control"
        value  = "no-store"
        append = false
      }
    }
  }

  routes {
    custom_route_object {
      route_ref {
        name      = volterra_route.query-match-route-tf.name
        namespace = var.xc_namespace
      }
    }
  }

  protected_cookies {
    name                         = "weak-cookie"
    samesite_strict              = true
    add_secure                   = true
    add_httponly                 = true
    disable_tampering_protection = true
  }

  cookie_stickiness {
    name            = "sticky"
    ttl             = 60
    path            = "/"
    ignore_httponly = true
    ignore_samesite = true
    ignore_secure   = true
  }

  more_option {

    request_headers_to_add {
      name   = "arch-http-scheme"
      value  = "$[scheme]"
      append = false
    }

    request_headers_to_add {
      name   = "arch-http-version"
      value  = "$[protocol]"
      append = false
    }

    request_headers_to_add {
      name   = "arch-tls-version"
      value  = "$[client_tls_version]"
      append = false
    }

    response_headers_to_add {
      name   = "Strict-Transport-Security"
      value  = "9999999"
      append = false
    }

    max_request_header_size     = "60"
    idle_timeout                = "30000"
    disable_default_error_pages = false
  }
}

resource "volterra_route" "query-match-route-tf" {
  name      = "query-match-route-tf"
  namespace = var.xc_namespace

  routes {
    match {
      http_method = "ANY"
      path {
        prefix = "/"
      }
      query_params {
        key   = "user"
        exact = "admin"
      }
    }
    route_direct_response {
      response_code = "200"
      response_body = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Admin</title>\n    <style>\n        body {\n            font-family: Arial, sans-serif;\n            margin: 0;\n            padding: 0;\n            display: flex;\n            justify-content: center; /* Center horizontally */\n            align-items: flex-start; /* Align container to the top */\n            min-height: 100vh; /* Ensure body takes full viewport height */\n            overflow-y: auto; /* Allow vertical scrolling if content is too tall */\n            text-align: center;\n        }\n        .wrapper {\n            display: flex;\n            flex-direction: column; /* Stack items vertically */\n            align-items: center; /* Center items horizontally */\n            max-width: 100%; /* Ensure container does not overflow horizontally */\n            padding: 20px; /* Optional padding for spacing */\n        }\n        .home-icon {\n            margin-bottom: 20px;\n        }\n        .home-icon img {\n            width: 32px;\n            height: 32px;\n        }\n        .container {\n            text-align: center;\n        }\n        .container p {\n            text-align: left; /* Align body text to the left */\n        }\n    </style>\n</head>\n<body>\n    <div class=\"wrapper\">\n        <div class=\"home-icon\">\n            <a href=\"https://reflect.archf5.com\">\n                <img src=\"/home.png\" alt=\"Home\">\n            </a>\n        </div>\n        <div class=\"container\">\n            <h1>Admin</h1>\n            <p>Matched your query parameter!</p>\n        </div>\n    </div>\n</body>\n</html>"
    }
    response_headers_to_add {
      name   = "Content-Type"
      value  = "text/html"
      append = false
    }
  }
}
