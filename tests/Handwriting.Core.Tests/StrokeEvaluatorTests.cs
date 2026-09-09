using Handwriting.Core;
using System.Text.Json;
using Xunit;

namespace Handwriting.Core.Tests;

public sealed class StrokeEvaluatorTests
{
    private static readonly StrokeDefinition Expected = new()
    {
        Points = [new(10, 20), new(30, 30), new(55, 45), new(80, 70)]
    };

    [Fact]
    public void Accepts_authentic_stroke_with_reasonable_noise()
    {
        var attempt = Attempt((11, 19), (20, 26), (31, 29), (43, 38), (56, 44), (68, 58), (79, 71));

        Assert.True(StrokeEvaluator.Evaluate(Expected, attempt).Passed);
    }

    [Fact]
    public void Rejects_wrong_direction() =>
        Assert.Equal("wrong-direction", StrokeEvaluator.Evaluate(Expected, Attempt((80, 70), (55, 45), (30, 30), (10, 20))).Reason);

    [Fact]
    public void Rejects_short_incomplete_stroke() =>
        Assert.Equal("incomplete", StrokeEvaluator.Evaluate(Expected, Attempt((10, 20), (20, 25), (30, 30))).Reason);

    [Fact]
    public void Rejects_scribble() =>
        Assert.Equal("scribble", StrokeEvaluator.Evaluate(Expected, Attempt((10, 20), (70, 70), (15, 25), (75, 65), (20, 30), (80, 70))).Reason);

    [Fact]
    public void Rejects_points_outside_normalized_bounds() =>
        Assert.Equal("out-of-bounds", StrokeEvaluator.Evaluate(Expected, Attempt((10, 20), (40, 30), (101, 50), (80, 70))).Reason);

    [Fact]
    public void Rejects_non_finite_coordinates() =>
        Assert.All(
            new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity },
            coordinate => Assert.Equal("out-of-bounds", StrokeEvaluator.Evaluate(
                Expected, new([new(10, 20), new(coordinate, 30), new(80, 70)])).Reason));

    [Fact]
    public void Rejects_click_but_accepts_a_short_dot_like_stroke()
    {
        var dot = new StrokeDefinition { Points = [new(40, 40), new(43, 40)] };

        Assert.Equal("incomplete", StrokeEvaluator.Evaluate(dot, Attempt((40, 40), (40, 40))).Reason);
        Assert.True(StrokeEvaluator.Evaluate(dot, Attempt((40, 40), (43, 40))).Passed);
    }

    [Fact]
    public void Short_dot_stroke_requires_direction_and_relative_coverage()
    {
        var dot = new StrokeDefinition { Points = [new(40, 40), new(43, 40)] };

        Assert.Equal("wrong-direction", StrokeEvaluator.Evaluate(dot, Attempt((43, 40), (40, 40))).Reason);
        Assert.False(StrokeEvaluator.Evaluate(dot, Attempt((40, 40), (40, 43))).Passed);
        Assert.Equal("incomplete", StrokeEvaluator.Evaluate(dot, Attempt((40, 40), (40.7, 40))).Reason);
    }

    [Fact]
    public void Rejects_closed_loop_drawn_in_the_wrong_direction()
    {
        var loop = new StrokeDefinition
        {
            Points = [new(20, 20), new(80, 20), new(80, 80), new(20, 80), new(20, 20)]
        };

        Assert.Equal("wrong-direction", StrokeEvaluator.Evaluate(
            loop, Attempt((20, 20), (20, 80), (80, 80), (80, 20), (20, 20))).Reason);
    }

    [Fact]
    public void Strict_mode_rejects_noise_that_relaxed_mode_accepts()
    {
        var attempt = Attempt((13, 17), (32, 34), (58, 41), (77, 74));

        Assert.True(StrokeEvaluator.Evaluate(Expected, attempt, relaxed: true).Passed);
        Assert.False(StrokeEvaluator.Evaluate(Expected, attempt, relaxed: false).Passed);
    }

    [Fact]
    public void Every_curriculum_stroke_passes_with_its_authored_points()
    {
        var strokes = CurriculumStrokes();

        Assert.Equal(174, strokes.Count);
        Assert.All(strokes, item => Assert.True(
            StrokeEvaluator.Evaluate(item.Stroke, new(item.Stroke.Points)).Passed,
            $"Expected {item.SymbolId} stroke {item.StrokeIndex} to pass."));
    }

    [Fact]
    public void Every_curriculum_stroke_rejects_its_reversed_points()
    {
        var strokes = CurriculumStrokes();

        Assert.Equal(174, strokes.Count);
        Assert.All(strokes, item =>
        {
            var reversed = item.Stroke.Points.AsEnumerable().Reverse().ToArray();
            var result = StrokeEvaluator.Evaluate(item.Stroke, new(reversed));
            Assert.False(result.Passed, $"Expected {item.SymbolId} stroke {item.StrokeIndex} reverse to fail.");
            Assert.Equal("wrong-direction", result.Reason);
        });
    }

    [Fact]
    public void Truncated_curriculum_loops_are_incomplete()
    {
        var loops = CurriculumStrokes()
            .Where(item => item.SymbolId is "numbers-0" or "lower-o")
            .ToArray();

        Assert.Equal(2, loops.Length);
        Assert.All(loops, item =>
        {
            var truncated = item.Stroke.Points.Take(44).ToArray();
            var result = StrokeEvaluator.Evaluate(item.Stroke, new(truncated));
            Assert.False(result.Passed, $"Expected truncated {item.SymbolId} loop to fail.");
            Assert.Equal("incomplete", result.Reason);
        });
    }

    private static IReadOnlyList<(string SymbolId, int StrokeIndex, StrokeDefinition Stroke)> CurriculumStrokes()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TestData", "symbols.json");
        var symbols = JsonSerializer.Deserialize<List<SymbolDefinition>>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        return symbols.SelectMany(symbol => symbol.Strokes.Select(
            (stroke, index) => (symbol.Id, index, stroke))).ToArray();
    }

    private static StrokeAttempt Attempt(params (double X, double Y)[] points) =>
        new(points.Select(point => new InkPoint(point.X, point.Y)).ToArray());
}
