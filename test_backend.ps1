# Test the backend webhook directly
$url = "https://chat-status-backend-n6gd7xskyq-uc.a.run.app/inbound/webhook"
$headers = @{
    "X-Webhook-Token" = "dropmanager-secret-2025"
    "Content-Type" = "application/json"
}

$body = @{
    messageText = "Completed user authentication and started payment integration"
    senderEmail = "test@company.com"
    senderDisplay = "Test User"
} | ConvertTo-Json

Write-Output "Testing backend webhook..."
Write-Output "URL: $url"
Write-Output "Body: $body"

try {
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body -UseBasicParsing
    Write-Output ""
    Write-Output "✅ SUCCESS - Response Code: $($response.StatusCode)"
    Write-Output "Response Content:"
    Write-Output $response.Content
} catch {
    Write-Output ""
    Write-Output "❌ ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorContent = $reader.ReadToEnd()
        Write-Output "Error Content: $errorContent"
    }
}

