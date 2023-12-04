terraform {
  required_providers {
    volterra = {
      source  = "volterraedge/volterra"
      version = "0.11.24"
    }
  }

  backend "azurerm" {
    resource_group_name  = "arch-storage-rg"
    storage_account_name = "xcterraformgithubactions"
    container_name       = "nginx-reflector"
    key                  = "terraform.tfstat"
  }
}


provider "kubernetes" {
  config_path    = "${path.module}/kubeconfig.yaml"
}

resource "kubernetes_namespace" "example" {
  metadata {
    name = "my-first-namespace"
  }
}

provider "volterra" {
  api_p12_file = var.xc_api_p12_file
  url          = var.xc_api_url
} 