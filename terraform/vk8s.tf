resource "kubernetes_deployment" "nginx-reflector" {
  metadata {
    name = "nginx-reflector"
    namespace = "s-archer"
  }

  spec {
    selector {
      match_labels = {
        app = "nginx-reflector"
      }
    }
    template  {
      metadata {
        labels = {
          app = "nginx-reflector"
        }
      }
      spec {
        container {
          image = "ghcr.io/s-archer/nginx-reflector:main"
          image_pull_policy = "Always"
          name = "nginx-reflector"
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