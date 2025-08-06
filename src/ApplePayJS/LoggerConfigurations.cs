using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Extensions.Hosting;

namespace YCWebsite.Application.Loggers
{
    public static class LoggerConfigurations
    {
        public static ReloadableLogger CreateSerilogLogger(string applicationName)
        {
            string environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                ?? "Production";

            var configuration = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile($"appsettings.{environmentName}.json", optional: true, reloadOnChange: true)
                .AddEnvironmentVariables()
                .Build();

            LoggerConfiguration loggerConfiguration = new();
            loggerConfiguration = loggerConfiguration.ReadFrom.Configuration(configuration);
            loggerConfiguration.Enrich.WithProperty("environment", environmentName ?? "EnvironmentName not set, check the application settings");
            loggerConfiguration.Enrich.WithProperty("application", applicationName ?? "ApplicationName not set, check the application settings");

            return loggerConfiguration.CreateBootstrapLogger();
        }
    }
}
