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