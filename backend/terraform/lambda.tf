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
  filename         = "${path.module}/../functions/github-oauth/dist/lambda.zip"
  function_name    = "${var.app_name}-github-auth-url"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.getAuthUrl"
  source_code_hash = filebase64sha256("${path.module}/../functions/github-oauth/dist/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30

  environment {
    variables = {
      REDIRECT_URI = "https://dzdzuh78hslou.cloudfront.net/auth/callback"
    }
  }
}

# Lambda function for OAuth callback
resource "aws_lambda_function" "github_callback" {
  filename         = "${path.module}/../functions/github-oauth/dist/lambda.zip"
  function_name    = "${var.app_name}-github-callback"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handleCallback"
  source_code_hash = filebase64sha256("${path.module}/../functions/github-oauth/dist/lambda.zip")
  runtime         = "nodejs22.x"
  timeout         = 30
}

# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.app_name}-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["https://dzdzuh78hslou.cloudfront.net"]  # Update with your domain
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 300
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${var.app_name}-api"
  retention_in_days = 7
  tags = {
    Environment = "var.environment"
    Project     = "var.app_name"
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