terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "ai-design-assistant-test-terraform-state"
    key    = "lambda/terraform.tfstate"
    region = "ca-central-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = var.app_name
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}