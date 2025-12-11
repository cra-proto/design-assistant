variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ca-central-1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "design-assistant"
}

variable "github_oauth_secret_name" {
  description = "Name of the secret in AWS Secrets Manager"
  type        = string
  default     = "prod/design-assistant/GitHub-OAuth"
}

variable "github_oauth_redirect_uri" {
  description = "GitHub OAuth redirect URI"
  type        = string
}

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
}