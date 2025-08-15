# Test webhook connection
$headers = @{
    'X-Webhook-Token' = 'test-token'
    'Content-Type' = 'application/x-www-form-urlencoded'
}

$body = 'messageText=Completed API documentation and fixed login bug. Working on database optimization next week.&senderEmail=john@company.com&senderDisplay=John Smith'

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8080/inbound/webhook' -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Output "Webhook Success: $($response.StatusCode)"
    Write-Output "Response: $($response.Content)"
} catch {
    Write-Output "Webhook Error: $($_.Exception.Message)"
}

# Test dashboard data
try {
    $dashResponse = Invoke-WebRequest -Uri 'http://localhost:8080/dashboard/overview' -UseBasicParsing
    Write-Output "Dashboard Success: $($dashResponse.StatusCode)"
    $data = $dashResponse.Content | ConvertFrom-Json
    Write-Output "Total Updates: $($data.analytics.totalUpdates)"
    Write-Output "Active Employees: $($data.analytics.activeEmployees)"
} catch {
    Write-Output "Dashboard Error: $($_.Exception.Message)"
}

