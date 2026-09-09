resource "aws_s3_bucket" "project_content" {
  bucket = "${var.app_name}-project-content"
}

resource "aws_s3_bucket_public_access_block" "project_content" {
  bucket                  = aws_s3_bucket.project_content.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "project_content" {
  bucket = aws_s3_bucket.project_content.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}