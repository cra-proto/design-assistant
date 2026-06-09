# Table #1 - Projects
resource "aws_dynamodb_table" "projects" {
  name           = "${var.app_name}-projects"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "owner"
    type = "S"
  }
  
  attribute {
    name = "repo"
    type = "S"
  }
  
  # Global secondary index for querying all public projects
  global_secondary_index {
    name            = "owner-repo-index"
    hash_key        = "owner"
    range_key       = "repo"
    projection_type = "ALL"
  }
  
  # Enable point-in-time recovery for backups
  point_in_time_recovery {
    enabled = true
  }
  
  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}

# Table #2 - Usage statistics
resource "aws_dynamodb_table" "usage" {
  name         = "${var.app_name}-usage"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}

# Table #3 - AI prompt versions
resource "aws_dynamodb_table" "prompts" {
  name         = "${var.app_name}-prompts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "promptHash"

  attribute {
    name = "promptHash"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}