using System.Text.Json;
using System.Text.Encodings.Web;
using Handwriting.Core;

var root = Path.GetFullPath(args.Length > 0 ? args[0] : ".");
var web = Path.Combine(root, "src", "Handwriting.Client", "wwwroot");
var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
var symbols = JsonSerializer.Deserialize<List<SymbolDefinition>>(File.ReadAllText(Path.Combine(web, "data", "symbols.json")), options)!;
var badges = BadgeCatalog.Create(symbols);
File.WriteAllText(Path.Combine(web, "data", "badges.json"), JsonSerializer.Serialize(badges, options));
Console.WriteLine($"已匯出 {badges.Count} 枚徽章規格。");
