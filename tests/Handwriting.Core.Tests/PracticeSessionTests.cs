using Handwriting.Core;
using Xunit;

namespace Handwriting.Core.Tests;

public sealed class PracticeSessionTests
{
    [Fact]
    public void Failed_attempt_can_be_retried_without_advancing()
    {
        var session = NewSession();

        Assert.False(session.Submit(Attempt((80, 10), (10, 10))).Passed);
        Assert.Equal(0, session.CurrentStroke);
        Assert.Equal(0, session.Progress.SuccessfulAttempts);

        Assert.True(session.Submit(Attempt((10, 10), (80, 10))).Passed);
        Assert.Equal(1, session.CurrentStroke);
        Assert.Equal(0, session.Progress.SuccessfulAttempts);
    }

    [Fact]
    public void Completion_is_counted_once_and_further_submissions_are_rejected()
    {
        var progress = new PracticeProgress();
        var session = NewSession(progress);

        session.Submit(Attempt((10, 10), (80, 10)));
        session.Submit(Attempt((20, 20), (20, 80)));
        var afterCompletion = session.Submit(Attempt((20, 20), (20, 80)));

        Assert.True(session.IsComplete);
        Assert.True(progress.Completed);
        Assert.Equal(1, progress.SuccessfulAttempts);
        Assert.NotNull(progress.LastPracticed);
        Assert.False(afterCompletion.Passed);
        Assert.Equal("complete", afterCompletion.Reason);
    }

    [Fact]
    public void Reset_restarts_strokes_and_counts_each_whole_symbol_completion()
    {
        var progress = new PracticeProgress();
        var session = NewSession(progress);
        session.Submit(Attempt((10, 10), (80, 10)));

        session.Reset();

        Assert.Equal(0, session.CurrentStroke);
        Assert.False(session.IsComplete);
        Assert.Equal(0, progress.SuccessfulAttempts);

        session.Submit(Attempt((10, 10), (80, 10)));
        session.Submit(Attempt((20, 20), (20, 80)));
        Assert.Equal(1, progress.SuccessfulAttempts);

        session.Reset();
        session.Submit(Attempt((10, 10), (80, 10)));
        session.Submit(Attempt((20, 20), (20, 80)));
        Assert.Equal(2, progress.SuccessfulAttempts);
    }

    [Fact]
    public void Submit_can_use_strict_evaluation()
    {
        var symbol = new SymbolDefinition
        {
            Strokes = [new() { Points = [new(10, 20), new(30, 30), new(55, 45), new(80, 70)] }]
        };
        var session = new PracticeSession(symbol);

        var result = session.Submit(Attempt((13, 17), (32, 34), (58, 41), (77, 74)), relaxed: false);

        Assert.False(result.Passed);
        Assert.Equal(0, session.CurrentStroke);
    }

    private static PracticeSession NewSession(PracticeProgress? progress = null) => new(
        new SymbolDefinition
        {
            Id = "test",
            Glyph = "十",
            Strokes =
            [
                new() { Points = [new(10, 10), new(80, 10)] },
                new() { Points = [new(20, 20), new(20, 80)] }
            ]
        }, progress);

    private static StrokeAttempt Attempt(params (double X, double Y)[] points) =>
        new(points.Select(point => new InkPoint(point.X, point.Y)).ToArray());
}
