namespace Handwriting.Core;

public sealed record InkPoint(double X, double Y, double Time = 0);

public sealed class StrokeDefinition
{
    public string Path { get; set; } = string.Empty;
    public List<InkPoint> Points { get; set; } = [];
    public string Instruction { get; set; } = string.Empty;
    public string Audio { get; set; } = string.Empty;
}

public sealed class SymbolDefinition
{
    public string Id { get; set; } = string.Empty;
    public string Glyph { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Order { get; set; }
    public List<StrokeDefinition> Strokes { get; set; } = [];
    public string Audio { get; set; } = string.Empty;
}

public sealed record StrokeAttempt(IReadOnlyList<InkPoint> Points);

public sealed record StrokeEvaluation(bool Passed, string Reason, string Message);

public static class StrokeEvaluator
{
    public static StrokeEvaluation Evaluate(StrokeDefinition expected, StrokeAttempt attempt, bool relaxed = true)
    {
        ArgumentNullException.ThrowIfNull(expected);
        ArgumentNullException.ThrowIfNull(attempt);

        var reference = expected.Points;
        var actual = attempt.Points;
        if (reference.Count < 2)
            return Fail("invalid-definition", "The expected stroke needs at least two points.");
        if (actual.Count < 2)
            return Fail("incomplete", "Continue drawing to finish the stroke.");
        if (actual.Any(point => !double.IsFinite(point.X) || !double.IsFinite(point.Y) ||
                                point.X is < 0 or > 100 || point.Y is < 0 or > 100))
            return Fail("out-of-bounds", "Keep the stroke inside the practice area.");

        var expectedLength = Length(reference);
        var actualLength = Length(actual);
        if (expectedLength <= 0)
            return Fail("invalid-definition", "The expected stroke must have a visible length.");
        if (actualLength < Math.Max(0.5, expectedLength * 0.2))
            return Fail("incomplete", "Continue drawing to finish the stroke.");

        var closed = Distance(reference[0], reference[^1]) <= expectedLength * 0.12;
        if (closed)
        {
            var expectedArea = SignedArea(reference);
            var actualArea = SignedArea(actual);
            if (Math.Abs(expectedArea) > 5 && Math.Abs(actualArea) > 5 && Math.Sign(expectedArea) != Math.Sign(actualArea))
                return Fail("wrong-direction", "Draw the stroke in the indicated direction.");
        }
        else
        {
            var forwardEnds = Distance(reference[0], actual[0]) + Distance(reference[^1], actual[^1]);
            var reverseEnds = Distance(reference[0], actual[^1]) + Distance(reference[^1], actual[0]);
            var directionMargin = Math.Min(5, expectedLength * 0.15);
            if (reverseEnds + directionMargin < forwardEnds)
                return Fail("wrong-direction", "Draw the stroke in the indicated direction.");
        }

        var endpointTolerance = Math.Min(relaxed ? 18d : 7d, expectedLength * (relaxed ? 0.35 : 0.18));
        var minimumLengthRatio = relaxed ? 0.68 : 0.85;
        var incomplete = closed
            ? Distance(actual[0], actual[^1]) > (relaxed ? 8 : 4) ||
              Distance(reference[0], actual[0]) > endpointTolerance ||
              actualLength < expectedLength * minimumLengthRatio
            : Distance(reference[0], actual[0]) > endpointTolerance ||
              Distance(reference[^1], actual[^1]) > endpointTolerance ||
              actualLength < expectedLength * minimumLengthRatio;
        if (incomplete)
            return Fail("incomplete", "Continue drawing to the end of the guide.");
        if (actualLength > expectedLength * (relaxed ? 1.8 : 1.35))
            return Fail("scribble", "Use one smooth stroke without doubling back.");

        var expectedSamples = Resample(reference, 24);
        var actualSamples = Resample(actual, 24);
        var distances = expectedSamples.Zip(actualSamples, Distance).ToArray();
        var averageTolerance = relaxed ? 10d : 2d;
        var maximumTolerance = relaxed ? 22d : 5d;
        if (distances.Average() > averageTolerance || distances.Max() > maximumTolerance)
            return Fail("off-path", "Follow the stroke guide more closely.");

        return new(true, "passed", "Good stroke.");
    }

    private static StrokeEvaluation Fail(string reason, string message) => new(false, reason, message);

    private static double Distance(InkPoint left, InkPoint right) =>
        Math.Sqrt(Math.Pow(right.X - left.X, 2) + Math.Pow(right.Y - left.Y, 2));

    private static double Length(IReadOnlyList<InkPoint> points)
    {
        var length = 0d;
        for (var index = 1; index < points.Count; index++)
            length += Distance(points[index - 1], points[index]);
        return length;
    }

    private static double SignedArea(IReadOnlyList<InkPoint> points)
    {
        var area = 0d;
        for (var index = 0; index < points.Count; index++)
        {
            var next = points[(index + 1) % points.Count];
            area += points[index].X * next.Y - next.X * points[index].Y;
        }
        return area / 2;
    }

    private static IReadOnlyList<InkPoint> Resample(IReadOnlyList<InkPoint> points, int count)
    {
        var cumulative = new double[points.Count];
        for (var index = 1; index < points.Count; index++)
            cumulative[index] = cumulative[index - 1] + Distance(points[index - 1], points[index]);

        var result = new List<InkPoint>(count);
        var segment = 1;
        for (var sample = 0; sample < count; sample++)
        {
            var target = cumulative[^1] * sample / (count - 1);
            while (segment < cumulative.Length - 1 && cumulative[segment] < target)
                segment++;
            var start = segment - 1;
            var span = cumulative[segment] - cumulative[start];
            var ratio = span == 0 ? 0 : (target - cumulative[start]) / span;
            result.Add(new(
                points[start].X + (points[segment].X - points[start].X) * ratio,
                points[start].Y + (points[segment].Y - points[start].Y) * ratio));
        }
        return result;
    }
}

public sealed class PracticeProgress
{
    public bool Completed { get; set; }
    public int SuccessfulAttempts { get; set; }
    public DateTimeOffset? LastPracticed { get; set; }
}

public sealed class PracticeSession
{
    public PracticeSession(SymbolDefinition symbol, PracticeProgress? progress = null)
    {
        Symbol = symbol ?? throw new ArgumentNullException(nameof(symbol));
        Progress = progress ?? new PracticeProgress();
    }

    public SymbolDefinition Symbol { get; }
    public PracticeProgress Progress { get; }
    public int CurrentStroke { get; private set; }
    public bool IsComplete => CurrentStroke >= Symbol.Strokes.Count;

    public StrokeEvaluation Submit(StrokeAttempt attempt, bool relaxed = true)
    {
        ArgumentNullException.ThrowIfNull(attempt);
        if (IsComplete)
            return new(false, "complete", "This symbol is already complete.");

        var evaluation = StrokeEvaluator.Evaluate(Symbol.Strokes[CurrentStroke], attempt, relaxed);
        if (!evaluation.Passed)
            return evaluation;

        CurrentStroke++;
        Progress.LastPracticed = DateTimeOffset.UtcNow;
        if (IsComplete)
        {
            Progress.Completed = true;
            Progress.SuccessfulAttempts++;
        }
        return evaluation;
    }

    public void Reset() => CurrentStroke = 0;
}
