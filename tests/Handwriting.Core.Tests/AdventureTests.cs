using Handwriting.Core;
using Xunit;

public class AdventureTests
{
    private static List<SymbolDefinition> Symbols() => System.Text.Json.JsonSerializer.Deserialize<List<SymbolDefinition>>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "symbols.json")),
        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

    [Fact]
    public void ExportedAssetCatalogMatchesRuntimeRules()
    {
        var exported = System.Text.Json.JsonSerializer.Deserialize<List<BadgeDefinition>>(
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "badges.json")),
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        Assert.Equal(BadgeCatalog.Create(Symbols()).Select(b => (b.Id, b.Name, b.Condition, b.Target, b.Mode)),
            exported.Select(b => (b.Id, b.Name, b.Condition, b.Target, b.Mode)));
    }

    [Fact]
    public void CatalogHas88UniqueBadgesAndAwardsAreIdempotent()
    {
        var symbols = Symbols();
        var catalog = BadgeCatalog.Create(symbols);
        Assert.Equal(88, catalog.Count);
        Assert.Equal(88, catalog.Select(b => b.Id).Distinct().Count());
        var child = new ChildProfile();
        child.StartedCategories.Add("numbers");
        Assert.Single(BadgeCatalog.Award(child, catalog));
        Assert.Empty(BadgeCatalog.Award(child, catalog));
        foreach (var symbol in symbols.Where(s => s.Category == "numbers"))
            child.Progress[symbol.Id] = new() { Completed = true, SuccessfulAttempts = 10 };
        Assert.Equal(6, BadgeCatalog.Award(child, catalog).Count);
        Assert.Equal(7, child.Awards.Count);
        Assert.DoesNotContain(child.Awards.Keys, id => id.Contains("upper"));
    }

    [Fact]
    public void EveryBadgeRequiresItsExactThreshold()
    {
        var symbols = Symbols();
        foreach (var badge in BadgeCatalog.Create(symbols))
        {
            var child = new ChildProfile();
            if (badge.Kind == "start") child.StartedCategories.Add(badge.Category);
            if (badge.Kind == "collect")
                foreach (var s in symbols.Where(s => s.Category == badge.Category).Take(badge.Target - 1))
                    child.Progress[s.Id] = new() { Completed = true, SuccessfulAttempts = 1 };
            if (badge.Kind == "practice")
                child.Progress[symbols.First(s => s.Category == badge.Category).Id] = new() { Completed = true, SuccessfulAttempts = badge.Target - 1 };
            if (badge.Kind == "wins") child.Challenges[badge.ChallengeKey] = new() { Wins = badge.Target - 1 };
            Assert.Equal(badge.Kind == "start", badge.Current(child) >= badge.Target);
            if (badge.Kind == "collect")
                child.Progress[symbols.Where(s => s.Category == badge.Category).ElementAt(badge.Target - 1).Id] = new() { Completed = true, SuccessfulAttempts = 1 };
            if (badge.Kind == "practice") child.Progress.Values.Single().SuccessfulAttempts++;
            if (badge.Kind == "wins") child.Challenges[badge.ChallengeKey].Wins++;
            if (badge.Kind == "length") child.Challenges[badge.ChallengeKey] = new() { CompletedLengths = [badge.Target] };
            Assert.Equal(badge.Target, badge.Current(child));
            Assert.Contains(BadgeCatalog.Award(child, [badge]), b => b.Id == badge.Id);
            Assert.Empty(BadgeCatalog.Award(child, [badge]));
            Assert.Equal(0, badge.Current(new ChildProfile()));
        }
    }

    [Fact]
    public void DrawCoversCategoriesAndDoesNotRepeatWithinRoundOrAtBoundary()
    {
        var symbols = Symbols();
        for (var seed = 0; seed < 100; seed++)
        {
            var numbers = ChallengeRun.Draw(symbols, ["numbers"], 20, new(seed));
            Assert.Equal(10, numbers.Take(10).Distinct().Count());
            Assert.Equal(10, numbers.Skip(10).Distinct().Count());
            Assert.NotEqual(numbers[9].Id, numbers[10].Id);
            var mixed = ChallengeRun.Draw(symbols, ["numbers", "upper", "lower", "zhuyin"], 5, new(seed));
            Assert.Equal(4, mixed.Select(s => s.Category).Distinct().Count());
            Assert.Equal(5, mixed.Distinct().Count());
        }
    }

    [Fact]
    public void ClockExcludesSystemAndPauseAndRejectsDeadlineCompletion()
    {
        var run = new ChallengeRun(ChallengeRun.Draw(Symbols(), ["numbers"], 5, new(1)), true, true);
        var budget = run.Remaining(0);
        Assert.Equal(budget, run.Remaining(100));
        run.SetWorking(true, 100);
        Assert.Equal(budget - 5, run.Remaining(105));
        run.SetWorking(false, 105);
        Assert.Equal(budget - 5, run.Remaining(500));
        run.Pause(500);
        run.SetWorking(true, 501);
        Assert.Equal(budget - 5, run.Remaining(600));
        run.Resume(600);
        run.SetWorking(true, 600);
        Assert.False(run.CompleteQuestion(0, 600 + budget - 5));
        Assert.Equal("timeout", run.Status);
        Assert.Equal(0, run.Completed);
    }

    [Fact]
    public void CompletionAndRewardsOnlySettleOnceAndMixedDoesNotCreditSubjects()
    {
        var child = new ChildProfile();
        var run = new ChallengeRun(ChallengeRun.Draw(Symbols(), ["numbers", "upper"], 10, new(3)), false, true);
        for (var i = 0; i < 10; i++)
        {
            Assert.True(run.CompleteQuestion(i, i));
            Assert.False(run.CompleteQuestion(i, i));
        }
        Assert.True(run.Settle(child));
        Assert.False(run.Settle(child));
        Assert.Single(child.Challenges);
        Assert.Equal(1, child.Challenges["mixed-adventure"].Wins);
        Assert.Contains(10, child.Challenges["mixed-adventure"].CompletedLengths);
        Assert.Equal(2, BadgeCatalog.Award(child, BadgeCatalog.Create(Symbols())).Count);
    }

    [Fact]
    public void AbortNeverGrantsWinAndChildrenDoNotShareProgress()
    {
        var run = new ChallengeRun(ChallengeRun.Draw(Symbols(), ["numbers"], 5, new(1)), false, true);
        run.CompleteQuestion(0, 0);
        run.Abort(1);
        Assert.False(run.CompleteQuestion(1, 2));
        Assert.False(run.Settle(new()));
        var a = new ChildProfile(); var b = new ChildProfile();
        a.StartedCategories.Add("numbers");
        BadgeCatalog.Award(a, BadgeCatalog.Create(Symbols()), true);
        Assert.Empty(b.Awards);
        Assert.All(a.Awards.Values, award => { Assert.True(award.Imported); Assert.Null(award.EarnedAt); });
    }

    [Fact]
    public void SingleRepeatedSymbolCannotCompleteCollectionAndModesStaySeparate()
    {
        var child = new ChildProfile();
        child.Progress["numbers-0"] = new() { Completed = true, SuccessfulAttempts = 100 };
        child.Challenges["numbers-adventure"] = new() { Wins = 25, CompletedLengths = [5] };
        var earned = BadgeCatalog.Award(child, BadgeCatalog.Create(Symbols()));
        Assert.DoesNotContain(earned, b => b.Kind == "collect" || b.Mode == "timed" || b.Kind == "length");
        Assert.Equal(7, earned.Count);
    }

    [Fact]
    public void TimedWinJustBeforeDeadlineAndUntimedLongPauseAreValid()
    {
        foreach (var timed in new[] { true, false })
        {
            var run = new ChallengeRun(ChallengeRun.Draw(Symbols(), ["numbers"], 5, new(7)), timed, true);
            run.SetWorking(true, 0);
            var time = timed ? run.Remaining(0) - .001 : 100000;
            for (var i = 0; i < 5; i++) Assert.True(run.CompleteQuestion(i, time));
            Assert.Equal("passed", run.Status);
            run.Abort(time + 10);
            Assert.Equal("passed", run.Status);
        }
    }
}
