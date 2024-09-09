
variable "xc_namespace" {
  type        = string
  description = "XC app namespace where the object will be created. This cannot be system or shared ns."
  default     = "s-archer"
}

variable "xc_tenant" {
  type        = string
  description = "XC tenant name"
  default     = "f5-emea-ent-bceuutam"
}

variable "xc_lb_domain" {
  type        = string
  description = "XC LB domain name"
  default     = "reflect.archf5.com"
}

variable "xc_api_url" {
  type        = string
  description = "XC tenant api url"
  default     = "https://f5-emea-ent.console.ves.volterra.io/api"
}

variable "xc_vk8s_name" {
  type        = string
  description = "XC vk8s name"
  default     = "arch-vk8s"
}

variable "xc_vk8s_virtual_site" {
  type        = string
  description = "XC vk8s virtual-site"
  default     = "arch-tn2-lon"
}

variable "xc_api_p12_file" {
  type        = string
  description = "XC protected vertificate file"
  default     = "./protected-se.p12"
}

variable "xc_deployment_name" {
  type        = string
  description = "XC container deployment name"
  default     = "nginx-reflector"
}