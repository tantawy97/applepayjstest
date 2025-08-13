namespace JustEat.ApplePayJS.Models;


public class ApplePayToken
{
    public string Data { get; set; }
    public string Signature { get; set; }
    public ApplePayHeader Header { get; set; }
    public string Version { get; set; }
}

public class ApplePayHeader
{
    public string TransactionId { get; set; }
    public string PublicKeyHash { get; set; }
    public string ApplicationData { get; set; }
    public string EphemeralPublicKey { get; set; }
}
