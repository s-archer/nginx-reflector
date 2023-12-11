
variable "xc_namespace" {
  type        = string
  description = "Volterra app namespace where the object will be created. This cannot be system or shared ns."
  default     = "s-archer"
}

variable "xc_tenant" {
  type        = string
  description = "Volterra tenant name"
  default     = "f5-emea-ent-bceuutam"
}

variable "xc_api_url" {
  type        = string
  description = "Volterra tenant api url"
  default     = "https://f5-emea-ent.console.ves.volterra.io/api"
}

variable "xc_vk8s_name" {
  type        = string
  description = "Volterra vk8s name"
  default     = "arch-vk8s"
}

variable "xc_api_p12_file" {
  type        = string
  description = "Volterra protected vertificate file"
  default     = "./protected-se.p12"
}

variable "xc_deployment_name" {
  type        = string
  description = "Volterra container deployment name"
  default     = "nginx-reflector"
}