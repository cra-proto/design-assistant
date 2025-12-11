variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ca-central-1"
}

variable "environment" {
  description = "Environment name (dev, production)"
  type        = string
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "design-assistant"
}