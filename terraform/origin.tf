resource "volterra_origin_pool" "nginx-reflector" {
  name                   = "nginx-reflector"
  namespace              = var.xc_namespace
  description            = "nginx-reflector"
  endpoint_selection     = "LOCAL_PREFERRED"
  loadbalancer_algorithm = "LB_OVERRIDE"
  port                   = 80
  no_tls                 = true

  origin_servers {

    k8s_service {
      service_name   = format("nginx-reflector.%s", var.xc_namespace)
      vk8s_networks = true

      site_locator {

        virtual_site {
          namespace = var.xc_namespace
          name      = var.xc_vk8s_virtual_site
        }
      }
    }
  }
}
