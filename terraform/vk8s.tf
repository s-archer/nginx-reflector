resource "volterra_api_credential" "vk8s" {
  name      = "api-cred-example"
  api_credential_type = "KUBE_CONFIG"
  virtual_k8s_namespace = var.xc_namespace
  virtual_k8s_name = var.xc_vk8s_name
}

resource "local_file" "rendered_kubeconfig" {
  content = base64decode(volterra_api_credential.vk8s.data)
  filename = "${path.module}/kubeconfig.yaml"
}

resource "kubernetes_manifest" "vk8s-deployment" {
  manifest = yamldecode(file("${path.module}/k8s-deployment.yaml"))
}

resource "kubernetes_manifest" "vk8s" {
  manifest = yamldecode(file("${path.module}/k8s-svc.yaml"))
}