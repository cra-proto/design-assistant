output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_stage.api.invoke_url}/auth/github"
}

output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.api.id
}

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    auth_url = aws_lambda_function.github_auth_url.function_name
    callback = aws_lambda_function.github_callback.function_name
  }
}

output "lambda_role_arn" {
  description = "IAM role ARN for Lambda functions"
  value       = aws_iam_role.lambda_role.arn
}