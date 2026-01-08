resource "aws_iam_role" "lambda_role" {
  name = "${var.app_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Policy to access Secrets Manager
resource "aws_iam_role_policy" "lambda_secrets_policy" {
  name = "${var.app_name}-lambda-secrets-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:prod/design-assistant/*"
      }
    ]
  })
}

# Attach basic Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function for getting auth URL
resource "aws_lambda_function" "github_auth_url" {
  filename         = "${path.module}/../functions/github-oauth/lambda.zip"
  function_name    = "${var.app_name}-${var.environment}-github-auth-url"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.getAuthUrl"
  source_code_hash = filebase64sha256("${path.module}/../functions/github-oauth/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30

  environment {
    variables = {
      REDIRECT_URI = var.github_oauth_redirect_uri
      ALLOWED_ORIGIN = var.allowed_origins[0]
      ENVIRONMENT = var.environment
    }
  }
}

# Lambda function for OAuth callback
resource "aws_lambda_function" "github_callback" {
  filename         = "${path.module}/../functions/github-oauth/lambda.zip"
  function_name    = "${var.app_name}-${var.environment}-github-callback"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handleCallback"
  source_code_hash = filebase64sha256("${path.module}/../functions/github-oauth/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30

  environment {
    variables = {
      ALLOWED_ORIGIN = var.allowed_origins[0]
      ENVIRONMENT    = var.environment
    }
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.app_name}-${var.environment}-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization", "x-amz-date", "x-api-key", "x-amz-security-token"]
    expose_headers = ["x-amzn-requestid", "x-amzn-trace-id"]
    max_age       = 300
    allow_credentials = true
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${var.app_name}-${var.environment}-api"
  retention_in_days = 7
  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "api" {
 # depends_on = [aws_cloudwatch_log_group.api_logs]
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true

 # access_log_settings {
 #  destination_arn = aws_cloudwatch_log_group.api_logs.arn
 #  format = jsonencode({
 #    requestId      = "$context.requestId"
 #    ip             = "$context.identity.sourceIp"
 #    requestTime    = "$context.requestTime"
 #    httpMethod     = "$context.httpMethod"
 #    routeKey       = "$context.routeKey"
 #    status         = "$context.status"
 #    protocol       = "$context.protocol"
 #    responseLength = "$context.responseLength"
 #  })
 #}
}

# Integration for auth URL endpoint
resource "aws_apigatewayv2_integration" "auth_url" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.github_auth_url.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth_url" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /auth/github/url"
  target    = "integrations/${aws_apigatewayv2_integration.auth_url.id}"
}

# Integration for callback endpoint
resource "aws_apigatewayv2_integration" "callback" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.github_callback.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "callback" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /auth/github/callback"
  target    = "integrations/${aws_apigatewayv2_integration.callback.id}"
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "auth_url" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.github_auth_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "callback" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.github_callback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# DynamoDB policy
resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "${var.app_name}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.projects.arn,
          "${aws_dynamodb_table.projects.arn}/index/*"
        ]
      }
    ]
  })
}

# Projects Lambda function
resource "aws_lambda_function" "projects" {
  filename         = "${path.module}/../functions/projects/lambda.zip"
  function_name    = "${var.app_name}-${var.environment}-projects"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../functions/projects/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.projects.name
      ALLOWED_ORIGIN = join(",", var.allowed_origins)
    }
  }
}

# Single integration for all project routes
resource "aws_apigatewayv2_integration" "projects" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.projects.invoke_arn
  payload_format_version = "2.0"
}

# Routes for projects
resource "aws_apigatewayv2_route" "projects_get" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /projects"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_post" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /projects"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_get_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /projects/{id+}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_put_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "PUT /projects/{id+}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_delete_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "DELETE /projects/{id+}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_options" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /projects"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

resource "aws_apigatewayv2_route" "projects_options_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /projects/{id+}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "projects" {
  statement_id  = "AllowAPIGatewayInvokeProjects"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.projects.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# Airtable Lambda Function
resource "aws_lambda_function" "airtable" {
  filename         = "${path.module}/../functions/airtable/lambda.zip"
  function_name    = "${var.app_name}-${var.environment}-airtable"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.getRecords"
  source_code_hash = filebase64sha256("${path.module}/../functions/airtable/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30

  environment {
    variables = {
      SECRET_NAME    = "prod/design-assistant/api-keys"
      ALLOWED_ORIGIN = var.allowed_origins[0]
      ENVIRONMENT    = var.environment
    }
  }
}

# Integration for Airtable endpoint
resource "aws_apigatewayv2_integration" "airtable" {
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.airtable.invoke_arn
  payload_format_version = "2.0"
}

# Route for GET /airtable/records
resource "aws_apigatewayv2_route" "airtable_records" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /airtable/records"
  target    = "integrations/${aws_apigatewayv2_integration.airtable.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "airtable" {
  statement_id  = "AllowAPIGatewayInvokeAirtable"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.airtable.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# TESTING
# Lambda Function URL for Airtable (bypasses API Gateway)
resource "aws_lambda_function_url" "airtable" {
  function_name      = aws_lambda_function.airtable.function_name
  authorization_type = "NONE"  # Public access
  
  cors {
    allow_origins     = ["*"]  # Fully permissive for testing
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }
}

# Resource-based policy to allow public invocation via Function URL
# Required for Function URLs created after October 2025
# Must include BOTH lambda:InvokeFunction AND lambda:InvokeFunctionUrl
resource "aws_lambda_permission" "airtable_function_url" {
  statement_id           = "AllowPublicFunctionURLInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.airtable.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Additional permission for InvokeFunction (required alongside InvokeFunctionUrl)
resource "aws_lambda_permission" "airtable_function_url_invoke" {
  statement_id  = "AllowPublicInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.airtable.function_name
  principal     = "*"
}

# Output the Function URL
output "airtable_function_url" {
  description = "Direct Lambda Function URL for Airtable (bypasses API Gateway)"
  value       = aws_lambda_function_url.airtable.function_url
}
