namespace Handwriting.Core;

public sealed class ChallengeRun
{
    public IReadOnlyList<SymbolDefinition> Questions { get; }
    public bool Timed { get; }
    public bool Relaxed { get; }
    public int Completed { get; private set; }
    public string Status { get; private set; } = "playing";
    public bool Paused { get; private set; }
    public string Category { get; }
    public string Key => Category + (Timed ? "-timed" : "-adventure");
    private double _remaining;
    private double? _workingSince;
    private bool _settled;

    public ChallengeRun(IReadOnlyList<SymbolDefinition> questions, bool timed, bool relaxed)
    {
        if (questions.Count == 0) throw new ArgumentException("至少需要一題。", nameof(questions));
        Questions = questions;
        Timed = timed;
        Relaxed = relaxed;
        Category = questions.Select(s => s.Category).Distinct().Count() == 1 ? questions[0].Category : "mixed";
        _remaining = questions.Sum(s => 15d + s.Strokes.Count * 15d);
    }

    public double Remaining(double now) => Math.Max(0, _remaining - (_workingSince is double since ? Math.Max(0, now - since) : 0));
    public bool Check(double now)
    {
        if (Status == "playing" && Timed && Remaining(now) <= 0)
        {
            _remaining = 0;
            _workingSince = null;
            Status = "timeout";
        }
        return Status == "playing" && !Paused;
    }

    public void SetWorking(bool working, double now)
    {
        if (!Check(now)) return;
        _remaining = Remaining(now);
        _workingSince = Timed && working ? now : null;
    }

    public void Pause(double now)
    {
        if (Status != "playing") return;
        SetWorking(false, now);
        Paused = Status == "playing";
    }

    public void Resume(double now)
    {
        if (Status != "playing") return;
        Paused = false;
        _workingSince = null;
    }

    public bool CompleteQuestion(int index, double now)
    {
        if (!Check(now) || index != Completed) return false;
        SetWorking(false, now);
        Completed++;
        if (Completed == Questions.Count) Status = "passed";
        return true;
    }

    public void Abort(double now)
    {
        if (Status != "playing") return;
        _remaining = Remaining(now);
        _workingSince = null;
        Status = "aborted";
    }

    public bool Settle(ChildProfile child)
    {
        if (_settled || Status != "passed") return false;
        _settled = true;
        if (!child.Challenges.TryGetValue(Key, out var progress)) child.Challenges[Key] = progress = new();
        if (progress.Wins < int.MaxValue) progress.Wins++;
        progress.CompletedLengths.Add(Questions.Count);
        return true;
    }

    public static List<SymbolDefinition> Draw(IReadOnlyList<SymbolDefinition> symbols, IReadOnlyList<string> categories, int count, Random random)
    {
        var selected = categories.Distinct().ToArray();
        if (count is not (5 or 10 or 20) || selected.Length is < 1 or > 4 || selected.Any(c => !BadgeCatalog.Categories.Take(4).Any(x => x.Key == c)))
            throw new ArgumentException("請選擇題型與 5、10 或 20 題。");
        var pool = symbols.Where(s => selected.Contains(s.Category)).ToArray();
        if (selected.Any(c => !pool.Any(s => s.Category == c))) throw new ArgumentException("教材不完整。");
        var result = new List<SymbolDefinition>();
        while (result.Count < count)
        {
            var round = pool.ToArray();
            random.Shuffle(round);
            if (result.Count == 0 && selected.Length > 1)
            {
                var firsts = selected.Select(c => round.First(s => s.Category == c)).ToArray();
                random.Shuffle(firsts);
                round = firsts.Concat(round.Except(firsts)).ToArray();
            }
            if (result.Count > 0 && round.Length > 1 && result[^1].Id == round[0].Id)
                (round[0], round[1]) = (round[1], round[0]);
            result.AddRange(round.Take(count - result.Count));
        }
        return result;
    }
}
