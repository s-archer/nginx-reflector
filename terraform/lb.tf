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
    custom_route_object {
      route_ref {
        name      = volterra_route.query-match-route-tf.name
        namespace = var.xc_namespace
      }
    }
  }

  protected_cookies {
    name = "weak-cookie"
    samesite_strict = true
    add_secure = true
    add_httponly = true
    disable_tampering_protection = true
  }

  cookie_stickiness {
    name = "sticky"
    ttl = 60
    path = "/"
    ignore_httponly = true
    ignore_samesite = true
    ignore_secure   = true
  }

  more_option {
    response_headers_to_add {
      name = "Strict-Transport-Security"
      value = "9999999"
      append = false
    }
    max_request_header_size = "60"
    idle_timeout = "30000"
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
        key = "user"
        exact = "admin"
      }
    }
    route_direct_response {
      response_code = "200"
      response_body = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Admin</title>\n    <style>\n        body {\n            font-family: Arial, sans-serif;\n            margin: 0;\n            padding: 0;\n            display: flex;\n            justify-content: center; /* Center horizontally */\n            align-items: flex-start; /* Align container to the top */\n            min-height: 100vh; /* Ensure body takes full viewport height */\n            overflow-y: auto; /* Allow vertical scrolling if content is too tall */\n            text-align: center;\n        }\n        .wrapper {\n            display: flex;\n            flex-direction: column; /* Stack items vertically */\n            align-items: center; /* Center items horizontally */\n            max-width: 100%; /* Ensure container does not overflow horizontally */\n            padding: 20px; /* Optional padding for spacing */\n        }\n        .home-icon {\n            margin-bottom: 20px;\n        }\n        .home-icon img {\n            width: 32px;\n            height: 32px;\n        }\n        .container {\n            text-align: center;\n        }\n        .container p {\n            text-align: left; /* Align body text to the left */\n        }\n    </style>\n</head>\n<body>\n    <div class=\"wrapper\">\n        <div class=\"home-icon\">\n            <a href=\"https://reflect.archf5.com\">\n                <img src=\"/home.png\" alt=\"Home\">\n            </a>\n        </div>\n        <div class=\"container\">\n            <h1>Admin</h1>\n            <p>Matched your query parameter!</p>\n        </div>\n    </div>\n</body>\n</html>"
    }
    response_headers_to_add {
      name = "Content-Type"
      value = "text/html"
      append = false
    }
  }
}