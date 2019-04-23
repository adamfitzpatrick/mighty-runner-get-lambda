

variable "function_name" {
    description = "Name of lambda function as deployed to AWS"
    default     = "get-lambda"
}

variable "dynamo_table_arn" {
    description = "ARN used for restricting lambda access to a specific dynamo table"
    default     = "*"
}

variable "table_name" {
    description = "DynamoDB table from which the lambda obtains data"
}

variable "primary_key_column_name" {
    description = "Primary key name for the DynamoDB source table"
}

variable "sort_key_column_name" {
    description = "Sort key name for the DynamoDB source table"
    default     = ""
}

variable "region" {
    description = "AWS region"
    default     = "us-west-2"
}

variable "cloudwatch_log_retention_in_days" {
    description = "Amount of time to retain log data"
    default     = "365"
}