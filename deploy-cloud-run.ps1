# Deploy DropManager to Google Cloud Run
param(
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "dropmanager",
    [string]$GeminiApiKey = "",
    [string]$InboundToken = "",
    [string]$ChatToken = ""
)

if ($ProjectId -eq "") {
    Write-Output "Please provide a Google Cloud Project ID:"
    Write-Output ".\deploy-cloud-run.ps1 -ProjectId 'your-project-id' -GeminiApiKey 'your-key' -InboundToken 'your-token' -ChatToken 'your-chat-token'"
    exit 1
}

Write-Output "Deploying DropManager to Cloud Run..."
Write-Output "Project: $ProjectId"
Write-Output "Region: $Region"
Write-Output "Service: $ServiceName"

# Set the project
gcloud config set project $ProjectId

# Enable required APIs
Write-Output "Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build and deploy to Cloud Run
Write-Output "Building and deploying to Cloud Run..."
gcloud run deploy $ServiceName `
    --source . `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars "NODE_ENV=production,GEMINI_API_KEY=$GeminiApiKey,INBOUND_TOKEN=$InboundToken,CHAT_VERIFICATION_TOKEN=$ChatToken" `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --timeout 300

if ($LASTEXITCODE -eq 0) {
    Write-Output ""
    Write-Output "🎉 Deployment successful!"
    Write-Output ""
    Write-Output "Your DropManager admin dashboard is now available at:"
    $serviceUrl = gcloud run services describe $ServiceName --region $Region --format "value(status.url)"
    Write-Output "$serviceUrl/admin"
    Write-Output ""
    Write-Output "API endpoints:"
    Write-Output "- Health: $serviceUrl/healthz"
    Write-Output "- Dashboard API: $serviceUrl/dashboard/overview"
    Write-Output "- Inbound Webhook: $serviceUrl/inbound/webhook"
    Write-Output ""
    Write-Output "Remember to:"
    Write-Output "1. Configure your Google Chat app to use the webhook URL"
    Write-Output "2. Set up proper authentication tokens"
    Write-Output "3. Test the integration"
} else {
    Write-Output "❌ Deployment failed. Check the error messages above."
    exit 1
}

