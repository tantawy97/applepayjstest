// Copyright (c) Just Eat, 2016. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

namespace JustEat.ApplePayJS.Controllers;

using JustEat.ApplePayJS.Clients;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Models;
using System.Net.Mime;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
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

        _logger.LogInformation("merchantSession - response:{@merchantSession}", merchantSession.RootElement);
        // Return the merchant session as-is to the JavaScript as JSON.
        return Json(merchantSession.RootElement);
    }

    [HttpPost]
    [Produces(MediaTypeNames.Application.Json)]
    [Route("applepay/token", Name = "MerchantToken")]
    public async Task<IActionResult> Token([FromBody] ApplePayToken model, CancellationToken cancellationToken = default)
    {
        
        _logger.LogInformation("token - model:{@model}", model);


        var certPath = "apple_pay.p12";
        var certPassword = "1234";
        var cert = new X509Certificate2(certPath, certPassword, X509KeyStorageFlags.Exportable);

        // Extract private key using BouncyCastle
        AsymmetricKeyParameter privateKey;
        using (var stream = new FileStream(certPath, FileMode.Open, FileAccess.Read))
        {
            var pkcs12Store = new Pkcs12Store(stream, certPassword.ToCharArray());
            string alias = pkcs12Store.Aliases.Cast<string>().FirstOrDefault(a => pkcs12Store.IsKeyEntry(a));
            privateKey = pkcs12Store.GetKey(alias).Key;
        }

        // Parse token fields
        byte[] ephemeralPublicKeyBytes = Convert.FromBase64String(model.Header.EphemeralPublicKey);
        byte[] encryptedData = Convert.FromBase64String(model.Data);

        // Perform ECDH key agreement
        var ephemeralPublicKey = (ECPublicKeyParameters)PublicKeyFactory.CreateKey(ephemeralPublicKeyBytes);
        var agreement = new ECDHBasicAgreement();
        agreement.Init(privateKey);
        var sharedSecret = agreement.CalculateAgreement(ephemeralPublicKey);
        byte[] sharedSecretBytes = sharedSecret.ToByteArrayUnsigned();

        // Derive symmetric key using SHA-256
        byte[] symmetricKey = SHA256.Create().ComputeHash(sharedSecretBytes);

        // Decrypt using AES-GCM
        byte[] iv = new byte[12];
        Array.Copy(encryptedData, 0, iv, 0, 12);

        byte[] cipherText = new byte[encryptedData.Length - 12 - 16];
        Array.Copy(encryptedData, 12, cipherText, 0, cipherText.Length);

        byte[] tag = new byte[16];
        Array.Copy(encryptedData, encryptedData.Length - 16, tag, 0, 16);

        byte[] plaintext = new byte[cipherText.Length];
        using (var aes = new AesGcm(symmetricKey))
        {
            aes.Decrypt(iv, cipherText, tag, plaintext);
        }

        var decryptedJson = Encoding.UTF8.GetString(plaintext);
        _logger.LogInformation("Decrypted Apple Pay Payload: {payload}", decryptedJson);

        return Json("done");
    }

    public IActionResult Error() => View();
}
