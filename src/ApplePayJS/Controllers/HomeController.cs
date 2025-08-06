// Copyright (c) Just Eat, 2016. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

namespace JustEat.ApplePayJS.Controllers;

using JustEat.ApplePayJS.Clients;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Models;
using System.Net.Mime;
using System.Text.Json;

public class HomeController(
    ApplePayClient client,
    MerchantCertificate certificate,
    IOptions<ApplePayOptions> options, ILogger<HomeController> _logger) : Controller
{
    public IActionResult Index()
    {
        // Get the merchant identifier and store name for use in the JavaScript by ApplePaySession.
        var model = new HomeModel()
        {
            MerchantId = certificate.GetMerchantIdentifier(),
            StoreName = options.Value.StoreName,
        };
        _logger.LogInformation("Index {@model}",model);
        return View(model);
    }

    [HttpPost]
    [Produces(MediaTypeNames.Application.Json)]
    [Route("applepay/validate", Name = "MerchantValidation")]
    public async Task<IActionResult> Validate([FromBody] ValidateMerchantSessionModel model, CancellationToken cancellationToken = default)
    {
        // You may wish to additionally validate that the URI specified for merchant validation in the
        // request body is a documented Apple Pay JS hostname. The IP addresses and DNS hostnames of
        // these servers are available here: https://developer.apple.com/documentation/applepayjs/setting_up_server_requirements
        if (!ModelState.IsValid ||
            string.IsNullOrWhiteSpace(model?.ValidationUrl) ||
            !Uri.TryCreate(model.ValidationUrl, UriKind.Absolute, out Uri? requestUri))
        {
            return BadRequest();
        }
        _logger.LogInformation("MerchantValidation - model:{@model}", model);

        // Create the JSON payload to POST to the Apple Pay merchant validation URL.
        var request = new MerchantSessionRequest()
        {
            DisplayName = options.Value.StoreName,
            Initiative = "web",
            InitiativeContext = Request.GetTypedHeaders().Host.Value,
            MerchantIdentifier = certificate.GetMerchantIdentifier(),
        };
        _logger.LogInformation("MerchantValidation - request:{@request}", request);

        JsonDocument merchantSession = await client.GetMerchantSessionAsync(requestUri, request, cancellationToken);

        // Return the merchant session as-is to the JavaScript as JSON.
        return Json(merchantSession.RootElement);
    }

    public IActionResult Error() => View();
}
