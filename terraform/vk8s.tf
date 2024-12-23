resource "kubernetes_deployment" "nginx-reflector" {
  metadata {
    name = var.xc_deployment_name
    namespace = var.xc_namespace
    annotations = {
      "ves.io/workload-flavor" = "arch-custom"
    }
  }

  spec {
    replicas = 1
    selector {
      match_labels = {
        app = var.xc_deployment_name
      }
    }
    template  {
      metadata {
        labels = {
          app = var.xc_deployment_name
        }
      }
      spec {
        container {
          image = "ghcr.io/s-archer/nginx-reflector:main"
          image_pull_policy = "Always"
          name = var.xc_deployment_name
          port {
            container_port = 8080
            protocol = "TCP"
          }
          volume_mount {
              mount_path = "/var/run"
              name = "nginx-run"
          }
          volume_mount {
            mount_path = "/var/cache/nginx"
            name = "nginx-cache"
          }
        }
        volume {
          empty_dir {
            size_limit = "10Mi"
          }
          name = "nginx-run"
        }
        volume {
          empty_dir {
            size_limit = "100Mi"
          }
          name = "nginx-cache"
        }
      }
    }
  }
}

resource "kubernetes_service" "nginx-reflector" {
  metadata {
    name = "nginx-reflector"
    namespace = var.xc_namespace
  }
  spec {
    selector = {
      app = var.xc_deployment_name
    }
    session_affinity = "ClientIP"
    port {
      port        = 80
      target_port = 8080
    }

    type = "ClusterIP"
  }
}