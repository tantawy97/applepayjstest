// Copyright (c) Just Eat, 2016. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

using JustEat.ApplePayJS.Controllers;
using System.Reflection;
using System.Text.Json;

namespace JustEat.ApplePayJS.Clients;

public class ApplePayClient(HttpClient httpClient, ILogger<ApplePayClient> _logger)
{
    public async Task<JsonDocument> GetMerchantSessionAsync(
        Uri requestUri,
        MerchantSessionRequest request,
        CancellationToken cancellationToken = default)
    {
        // POST the data to create a valid Apple Pay merchant session.
        using var response = await httpClient.PostAsJsonAsync(requestUri, request, cancellationToken);
        _logger.LogInformation("MerchantValidation - response StatusCode:{@StatusCode}", response.StatusCode);
        _logger.LogInformation("MerchantValidation - response:{@response}", response);

        //response.EnsureSuccessStatusCode();

        // Read the opaque merchant session JSON from the response body.
        var merchantSession = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken);
        _logger.LogInformation("MerchantValidation - merchansession:{@merchantSession}", merchantSession);
        return merchantSession!;
    }
}
