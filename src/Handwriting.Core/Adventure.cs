namespace Handwriting.Core;

public sealed class AdventureState
{
    public int Version { get; set; } = 2;
    public List<ChildProfile> Children { get; set; } = [];
    public string? ActiveChildId { get; set; }
    public bool Muted { get; set; }
    public bool Relaxed { get; set; } = true;
    public Dictionary<string, PracticeProgress>? LegacyProgress { get; set; }
}

public sealed class ChildProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Avatar { get; set; } = "numbers";
    public Dictionary<string, PracticeProgress> Progress { get; set; } = [];
    public HashSet<string> StartedCategories { get; set; } = [];
    public Dictionary<string, ChallengeProgress> Challenges { get; set; } = [];
    public Dictionary<string, BadgeAward> Awards { get; set; } = [];
}

public sealed class ChallengeProgress
{
    public int Wins { get; set; }
    public HashSet<int> CompletedLengths { get; set; } = [];
}

public sealed class BadgeAward
{
    public DateTimeOffset? EarnedAt { get; set; }
    public bool Imported { get; set; }
}

public sealed record BadgeDefinition(string Id, string Name, string Category, string Kind,
    int Target, string Mode, string Condition, IReadOnlyList<string> SymbolIds)
{
    public string ChallengeKey => Category + "-" + Mode;
    public string Group => Kind switch { "start" => "勇敢開始", "collect" => "學習收集", "practice" => "反覆練習", _ => "闖關成就" };
    public string Image => $"images/badges/{Id}.svg";
    public string Audio => $"audio/badges/{Id}.mp3";
    public long Current(ChildProfile child) => Kind switch
    {
        "start" => child.StartedCategories.Contains(Category) ? 1 : 0,
        "collect" => SymbolIds.Count(id => child.Progress.TryGetValue(id, out var p) && p.Completed),
        "practice" => SymbolIds.Sum(id => child.Progress.TryGetValue(id, out var p) ? (long)p.SuccessfulAttempts : 0),
        "wins" => child.Challenges.TryGetValue(ChallengeKey, out var c) ? c.Wins : 0,
        "length" => child.Challenges.TryGetValue(ChallengeKey, out var c) && c.CompletedLengths.Contains(Target) ? Target : 0,
        _ => 0
    };
}

public static class BadgeCatalog
{
    public static readonly (string Key, string Label, string Animal)[] Categories =
        [("numbers", "數字", "小兔"), ("upper", "大寫英文", "小獅子"), ("lower", "小寫英文", "小狐狸"), ("zhuyin", "注音", "小貓頭鷹"), ("mixed", "綜合", "探險隊")];

    public static List<BadgeDefinition> Create(IReadOnlyList<SymbolDefinition> symbols)
    {
        var result = new List<BadgeDefinition>();
        foreach (var (key, label, _) in Categories)
        {
            var ids = symbols.Where(s => s.Category == key).Select(s => s.Id).ToArray();
            if (key != "mixed")
            {
                result.Add(new($"{key}-start-1", $"{label}初體驗", key, "start", 1, "", $"在{label}練習中，勇敢畫下第一筆。", ids));
                foreach (var n in new[] { 3, 5, ids.Length })
                    result.Add(new($"{key}-collect-{n}", $"{label}{(n == ids.Length ? "全收集" : $"收集家 {n}")}", key, "collect", n, "", $"完整寫完{n}個不同的{label}符號。", ids));
                foreach (var n in new[] { 10, 30, 100 })
                    result.Add(new($"{key}-practice-{n}", $"{label}練習家 {n}", key, "practice", n, "", $"累積完整寫完{label}符號{n}次，重複練習也算喔。", ids));
            }
            foreach (var mode in new[] { "adventure", "timed" })
            {
                var modeName = mode == "timed" ? "限時挑戰" : "不限時冒險";
                foreach (var n in new[] { 1, 5, 10, 25 })
                    result.Add(new($"{key}-{mode}-wins-{n}", $"{label}{modeName} {n} 次", key, "wins", n, mode, $"通過{label}{modeName}{n}次，每場五題、十題或二十題都算一次。", ids));
                foreach (var n in new[] { 10, 20 })
                    result.Add(new($"{key}-{mode}-length-{n}", $"{label}{modeName}耐力 {n}", key, "length", n, mode, $"通過一場{n}題的{label}{modeName}。", ids));
            }
        }
        return result;
    }

    public static List<BadgeDefinition> Award(ChildProfile child, IEnumerable<BadgeDefinition> catalog, bool imported = false)
    {
        var earned = new List<BadgeDefinition>();
        foreach (var badge in catalog)
            if (!child.Awards.ContainsKey(badge.Id) && badge.Current(child) >= badge.Target)
            {
                child.Awards.Add(badge.Id, new() { EarnedAt = imported ? null : DateTimeOffset.UtcNow, Imported = imported });
                earned.Add(badge);
            }
        return earned;
    }
}
