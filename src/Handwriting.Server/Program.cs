var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

if (!app.Environment.IsDevelopment()) app.UseHsts();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        if (context.File.Name is "service-worker.js" or "service-worker-assets.js" or "index.html")
            context.Context.Response.Headers.CacheControl = "no-cache";
    }
});
app.MapStaticAssets();
app.MapFallbackToFile("index.html");

app.Run();
