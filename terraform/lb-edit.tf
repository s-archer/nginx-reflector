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
    simple_route {
      caching_disable = true
      http_method = "ANY"
      path {
        prefix = "/waf-bypass"
      }
      origin_pools {
        pool {
          name = volterra_origin_pool.nginx-reflector.name
          namespace = var.xc_namespace
        }
      }
    }
  }

  routes {
    custom_route_object {
      route_ref {
        name      = volterra_route.waiting-room-route-tf.name
        namespace = var.xc_namespace
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

  routes {
    custom_route_object {
      route_ref {
        name      = volterra_route.waf-enabled-and-cdn-bypass.name
        namespace = var.xc_namespace
      }
    }
  }

  caching_policy {
    default_cache_action {
      cache_ttl_override = "120s"
    }
    custom_cache_rule {
       cdn_cache_rules {
          name      = volterra_cdn_cache_rule.reflect-cache.name
          namespace = var.xc_namespace
       }
       cdn_cache_rules {
          name      = volterra_cdn_cache_rule.reflect-bypass-cdn.name
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

resource "volterra_route" "waf-enabled-and-cdn-bypass" {
  name      = "query-match-route-tf"
  namespace = var.xc_namespace

  routes {
    match {
      http_method = "ANY"
      path {
        prefix = "/output-headers"
      }
    }
    route_destination {
      destinations {
        cluster {
          name = volterra_origin_pool.nginx-reflector.name
          namespace = var.xc_namespace
        }
      }
    }

    response_headers_to_add {
      name   = "Content-Type"
      value  = "text/html"
      append = false
    }
  }
}

resource "volterra_route" "waiting-room-route-tf" {
  name      = "waiting-room-route-tf"
  namespace = var.xc_namespace

  routes {
    match {
      http_method = "ANY"
      path {
        prefix = "/queue-demo"
      }
      headers {
        name         = "Cookie"
        regex        = ".*wr_admit=.*"
        invert_match = true
      }
    }
    route_direct_response {
      response_code = "200"
      response_body = <<-HTML
<!DOCTYPE html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F5 Waiting Room</title>
<style>
body{margin:0;font:16px/1.5 Arial,sans-serif;background:#f6f1e8;color:#171717;display:grid;place-items:center;min-height:100vh}
.c{width:min(680px,92vw);padding:28px;border:1px solid #ddd;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.12);border-radius:24px}
.b{font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e4002b}
h1{margin:.5rem 0 1rem;font-size:clamp(2rem,5vw,3.2rem);line-height:.95}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}
.k{border:1px solid #e7e2d8;border-radius:16px;padding:14px;background:#faf7f1}.l{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.08em}.v{font-size:28px;font-weight:700}
#s{padding:14px;border-radius:16px;background:#1c1c1c;color:#fff}
</style>
<main class=c><div class=b>F5 Waiting Room</div><h1>Please hold while we admit visitors in turn.</h1><p>Keep this tab open and we will redirect you automatically when your slot is available.</p><div class=g><div class=k><div class=l>Position</div><div class=v id=p>-</div></div><div class=k><div class=l>Waited</div><div class=v id=w>-</div></div><div class=k><div class=l>Depth</div><div class=v id=d>-</div></div></div><div id=s>Contacting the queue service...</div></main>
<script>
const t=location.pathname+location.search,p=document.getElementById("p"),w=document.getElementById("w"),d=document.getElementById("d"),s=document.getElementById("s");
async function q(){try{const r=await fetch("/queue/api/status?target="+encodeURIComponent(t),{credentials:"include",cache:"no-store"});if(!r.ok)throw new Error(r.status);const j=await r.json();if(j.admitted){p.textContent=0;d.textContent=0;s.textContent="Your slot is ready. Redirecting now...";location.replace(j.target||t);return}p.textContent=j.position??"-";w.textContent=(j.waited_seconds??0)+"s";d.textContent=j.queue_depth??"-";s.textContent="Minimum wait "+(j.min_wait_seconds??"-")+"s. We will refresh your place automatically."}catch(e){s.textContent="We could not refresh your queue status. Retrying..."}setTimeout(q,1000)}q();
</script>
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

resource "volterra_cdn_cache_rule" "reflect-bypass-cdn" {
  name      = "reflect-bypass-cdn"
  namespace = var.xc_namespace

  cache_rules {
    rule_name      = "reflect-bypass-cdn"
    # This bypass does not appear to use routes... but is handled in CDN
    cache_bypass = true
    rule_expression_list {
      expression_name = "waf-bypass"
      cache_rule_expression {
        path_match {
          operator {
            startswith = "/"
          }
        }
      }
    }
  }
}

resource "volterra_cdn_cache_rule" "reflect-cache" {
  name      = "reflect-cache"
  namespace = var.xc_namespace

  cache_rules {
    rule_name      = "reflect-cache"
    rule_expression_list {
      expression_name = "cache-it-path"
      cache_rule_expression {
        path_match {
          operator {
            startswith = "/cache-it/"
          }
        }
      }
    }
    eligible_for_cache {
      scheme_proxy_host_uri {
        cache_ttl = "120s"
        ignore_response_cookie = true
        cache_override = true
      }
    }
  }
}