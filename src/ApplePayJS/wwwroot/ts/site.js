var justEat;
(function (justEat) {
    var ApplePay = (function () {
        function ApplePay() {
            var _this = this;
            this.beginPayment = function (e) {
                e.preventDefault();
                var subtotal = $("#amount").val().toString();
                var delivery = "0.01";
                var deliveryTotal = (parseFloat(subtotal) + parseFloat(delivery)).toString(10);
                var totalForCollection = {
                    label: _this.storeName,
                    amount: subtotal
                };
                var lineItemsForCollection = [
                    { label: "Subtotal", amount: subtotal, type: "final" }
                ];
                var totalForDelivery = {
                    label: _this.storeName,
                    amount: deliveryTotal
                };
                var lineItemsForDelivery = [
                    { label: "Subtotal", amount: subtotal, type: "final" },
                    { label: "Delivery", amount: delivery, type: "final" }
                ];
                var paymentRequest = _this.createPaymentRequest(delivery, lineItemsForDelivery, totalForDelivery);
                _this.session = new ApplePaySession(_this.applePayVersion, paymentRequest);
                _this.session.onvalidatemerchant = _this.onValidateMerchant;
                _this.session.onshippingmethodselected = function (event) {
                    var newTotal;
                    var newLineItems;
                    if (event.shippingMethod.identifier === "collection") {
                        newTotal = totalForCollection;
                        newLineItems = lineItemsForCollection;
                    }
                    else {
                        newTotal = totalForDelivery;
                        newLineItems = lineItemsForDelivery;
                    }
                    var update = {
                        newTotal: newTotal,
                        newLineItems: newLineItems
                    };
                    _this.session.completeShippingMethodSelection(update);
                };
                _this.session.onpaymentauthorized = _this.onPaymentAuthorized;
                _this.session.begin();
            };
            this.createPaymentRequest = function (deliveryAmount, lineItems, total) {
                var paymentRequest = {
                    applicationData: btoa("Custom application-specific data"),
                    countryCode: _this.countryCode,
                    currencyCode: _this.currencyCode,
                    merchantCapabilities: ["supports3DS", "supportsCredit", "supportsDebit"],
                    supportedNetworks: ["amex", "discover", "jcb", "masterCard", "privateLabel", "visa"],
                    lineItems: lineItems,
                    total: total,
                    requiredBillingContactFields: ["email", "name", "phone", "postalAddress"],
                    requiredShippingContactFields: ["email", "name", "phone", "postalAddress"],
                    shippingType: "delivery",
                    shippingMethods: [
                        { label: "Delivery", amount: deliveryAmount, identifier: "delivery", detail: "Delivery to you" },
                        { label: "Collection", amount: "0.00", identifier: "collection", detail: "Collect from the store" }
                    ],
                    supportedCountries: [_this.countryCode]
                };
                return paymentRequest;
            };
            this.onPaymentAuthorized = function (event) {
                var token = event.payment.token;
                var authorizationResult = _this.captureFunds(token);
                if (authorizationResult.status === ApplePaySession.STATUS_SUCCESS) {
                    var billingContact = event.payment.billingContact;
                    var shippingContact = event.payment.shippingContact;
                    $(".card-name").text(event.payment.token.paymentMethod.displayName);
                    _this.updatePanel($("#billing-contact"), billingContact);
                    _this.updatePanel($("#shipping-contact"), shippingContact);
                    _this.showSuccess();
                }
                else {
                    var errors = authorizationResult.errors.map(function (error) {
                        return error.message;
                    });
                    _this.showError("Your payment could not be processed. " + errors.join(" "));
                    authorizationResult.errors.forEach(function (error) {
                        console.error(error.message + " (" + error.contactField + ": " + error.code + ").");
                    });
                }
                _this.session.completePayment(authorizationResult);
            };
            this.onValidateMerchant = function (event) {
                var data = {
                    validationUrl: event.validationURL
                };
                var headers = _this.createValidationHeaders();
                var request = _this.createValidationRequest(data, headers);
                $.ajax(request).then(function (merchantSession) {
                    _this.session.completeMerchantValidation(merchantSession);
                });
            };
            this.createValidationRequest = function (data, headers) {
                return {
                    url: _this.validationResource,
                    method: "POST",
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify(data),
                    headers: headers
                };
            };
            this.setupApplePay = function () {
                return ApplePaySession.openPaymentSetup(_this.merchantIdentifier)
                    .then(function (success) {
                    if (success) {
                        _this.hideSetupButton();
                        _this.showButton();
                    }
                    else {
                        _this.showError("Failed to set up Apple Pay.");
                    }
                    return success;
                }).catch(function (err) {
                    _this.showError("Failed to set up Apple Pay. " + JSON.stringify(err));
                    return false;
                });
            };
            this.showButton = function () {
                var button = $("#apple-pay-button");
                button.attr("lang", _this.getPageLanguage());
                button.on("click", _this.beginPayment);
                if (_this.supportsSetup()) {
                    button.addClass("apple-pay-button-with-text");
                    button.addClass("apple-pay-button-black-with-text");
                }
                else {
                    button.addClass("apple-pay-button");
                    button.addClass("apple-pay-button-black");
                }
                button.removeClass("d-none");
            };
            this.showSetupButton = function () {
                var button = $("#set-up-apple-pay-button");
                button.attr("lang", _this.getPageLanguage());
                button.on("click", _this.setupApplePay);
                button.removeClass("d-none");
            };
            this.updatePanel = function (panel, contact) {
                if (contact.emailAddress) {
                    panel.find(".contact-email")
                        .text(contact.emailAddress)
                        .attr("href", "mailto:" + contact.emailAddress)
                        .append("<br/>")
                        .removeClass("d-none");
                }
                if (contact.phoneNumber) {
                    panel.find(".contact-telephone")
                        .text(contact.phoneNumber)
                        .attr("href", "tel:" + contact.phoneNumber)
                        .append("<br/>")
                        .removeClass("d-none");
                }
                if (contact.givenName) {
                    panel.find(".contact-name")
                        .text(contact.givenName + " " + contact.familyName)
                        .append("<br/>")
                        .removeClass("d-none");
                }
                if (contact.addressLines) {
                    panel.find(".contact-address-lines").text(contact.addressLines.join(", "));
                    panel.find(".contact-sub-locality").text(contact.subLocality);
                    panel.find(".contact-locality").text(contact.locality);
                    panel.find(".contact-sub-administrative-area").text(contact.subAdministrativeArea);
                    panel.find(".contact-administrative-area").text(contact.administrativeArea);
                    panel.find(".contact-postal-code").text(contact.postalCode);
                    panel.find(".contact-country").text(contact.country);
                    panel.find(".contact-address").removeClass("d-none");
                }
            };
            this.merchantIdentifier = $("meta[name='apple-pay-merchant-id']").attr("content");
            this.storeName = $("meta[name='apple-pay-store-name']").attr("content");
            this.validationResource = $("link[rel='merchant-validation']").attr("href");
            this.applePayVersion = 10;
            this.countryCode = $("meta[name='payment-country-code']").attr("content") || "US";
            this.currencyCode = $("meta[name='payment-currency-code']").attr("content") || "USD";
        }
        ApplePay.prototype.initialize = function () {
            var _this = this;
            if (!this.merchantIdentifier) {
                this.showError("No Apple Pay merchant certificate is configured.");
            }
            else if (this.supportedByDevice() === true) {
                if (this.canMakePayments() === true) {
                    this.showButton();
                }
                else {
                    this.canMakePaymentsWithActiveCard().then(function (canMakePayments) {
                        if (canMakePayments === true) {
                            _this.showButton();
                        }
                        else {
                            if (_this.supportsSetup()) {
                                _this.showSetupButton();
                            }
                            else {
                                _this.showError("Apple Pay cannot be used at this time. If using macOS you need to be paired with a device that supports at least TouchID.");
                            }
                        }
                    });
                }
            }
            else {
                this.showError("This device and/or browser does not support Apple Pay.");
            }
        };
        ApplePay.prototype.captureFunds = function (token) {
            return {
                status: ApplePaySession.STATUS_SUCCESS,
                errors: []
            };
        };
        ApplePay.prototype.canMakePayments = function () {
            return ApplePaySession.canMakePayments();
        };
        ApplePay.prototype.canMakePaymentsWithActiveCard = function () {
            return ApplePaySession.canMakePaymentsWithActiveCard(this.merchantIdentifier);
        };
        ApplePay.prototype.getPageLanguage = function () {
            return $("html").attr("lang") || "en";
        };
        ApplePay.prototype.hideSetupButton = function () {
            var button = $("#set-up-apple-pay-button");
            button.addClass("d-none");
            button.off("click");
        };
        ApplePay.prototype.createValidationHeaders = function () {
            var headers = {};
            var antiforgeryHeader = $("meta[name='x-antiforgery-name']").attr("content");
            var antiforgeryToken = $("meta[name='x-antiforgery-token']").attr("content");
            headers[antiforgeryHeader] = antiforgeryToken;
            return headers;
        };
        ApplePay.prototype.showError = function (text) {
            var error = $(".apple-pay-error");
            error.text(text);
            error.removeClass("d-none");
        };
        ApplePay.prototype.showSuccess = function () {
            $(".apple-pay-intro").hide();
            var success = $(".apple-pay-success");
            success.removeClass("d-none");
        };
        ApplePay.prototype.supportedByDevice = function () {
            return "ApplePaySession" in window && ApplePaySession !== undefined;
        };
        ApplePay.prototype.supportsSetup = function () {
            return "openPaymentSetup" in ApplePaySession;
        };
        return ApplePay;
    }());
    justEat.ApplePay = ApplePay;
})(justEat || (justEat = {}));
(function () {
    var handler = new justEat.ApplePay();
    handler.initialize();
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNpdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsSUFBVSxPQUFPLENBMGNoQjtBQTFjRCxXQUFVLE9BQU87SUFLYjtRQWNJO1lBQUEsaUJBZUM7WUEwQ08saUJBQVksR0FBRyxVQUFDLENBQW9CO2dCQUV4QyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBSW5CLElBQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDL0MsSUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDO2dCQUN4QixJQUFNLGFBQWEsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBRWpGLElBQU0sa0JBQWtCLEdBQUc7b0JBQ3ZCLEtBQUssRUFBRSxLQUFJLENBQUMsU0FBUztvQkFDckIsTUFBTSxFQUFFLFFBQVE7aUJBQ25CLENBQUM7Z0JBRUYsSUFBTSxzQkFBc0IsR0FBa0M7b0JBQzFELEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7aUJBQ3pELENBQUM7Z0JBRUYsSUFBTSxnQkFBZ0IsR0FBRztvQkFDckIsS0FBSyxFQUFFLEtBQUksQ0FBQyxTQUFTO29CQUNyQixNQUFNLEVBQUUsYUFBYTtpQkFDeEIsQ0FBQztnQkFFRixJQUFNLG9CQUFvQixHQUFrQztvQkFDeEQsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtvQkFDdEQsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtpQkFDekQsQ0FBQztnQkFHRixJ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