using Handwriting.Core;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Handwriting.Client.Components;

public partial class PracticeBoard
{
    [Parameter, EditorRequired] public SymbolDefinition Symbol { get; set; } = null!;
    [Parameter] public string RunKey { get; set; } = "";
    [Parameter] public bool AutoStart { get; set; }
    [Parameter] public bool Relaxed { get; set; } = true;
    [Parameter] public bool Muted { get; set; }
    [Parameter] public bool Suspended { get; set; }
    [Parameter] public EventCallback OnStarted { get; set; }
    [Parameter] public EventCallback OnCompleted { get; set; }
    [Parameter] public EventCallback<bool> OnBusy { get; set; }
    [Parameter] public EventCallback<string> OnNotice { get; set; }
    [Parameter] public EventCallback OnAgain { get; set; }
    [Parameter] public EventCallback OnNext { get; set; }
    [Parameter] public Func<Task<bool>>? BeforeSubmit { get; set; }
    private PracticeSession? _session;
    private IJSObjectReference? _module;
    private DotNetObjectReference<PracticeBoard>? _self;
    private static int _nextGeneration;
    private int _generation;
    private string? _previousKey;
    private bool _wasSuspended, _started, _pendingCanvas, _pendingCue, _cueBusy, _submitting, _disposed, _feedbackGood;
    private string _feedback = "從橘色圓點開始，照著淡淡的線寫。";
    private StrokeDefinition CurrentStroke => Symbol.Strokes[_session!.CurrentStroke];

    protected override async Task OnParametersSetAsync()
    {
        if (_previousKey != RunKey)
        {
            await Cancel();
            _previousKey = RunKey;
            _session = new(Symbol);
            _started = AutoStart;
            _pendingCanvas = _pendingCue = _started;
            _feedbackGood = false;
            _feedback = "從橘色圓點開始，照著淡淡的線寫。";
        }
        if (Suspended != _wasSuspended)
        {
            await Cancel();
            _wasSuspended = Suspended;
            if (!Suspended && _started && _session is { IsComplete: false }) _pendingCanvas = _pendingCue = true;
        }
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _module = await JS.InvokeAsync<IJSObjectReference>("import", "./js/practice.js");
            _self = DotNetObjectReference.Create(this);
        }
        if (_module is null || _disposed || Suspended || !_started || _session is null || _session.IsComplete) return;
        var token = _generation;
        if (_pendingCanvas)
        {
            _pendingCanvas = false;
            await _module.InvokeVoidAsync("initCanvas", "practice-canvas", _self, token);
        }
        if (_pendingCue)
        {
            _pendingCue = false;
            _cueBusy = true;
            await OnBusy.InvokeAsync(true);
            StateHasChanged();
            var ok = await _module.InvokeAsync<bool>("requiredCue", _session.CurrentStroke,
                Muted ? Array.Empty<string>() : new[] { Symbol.Audio, CurrentStroke.Audio }, token);
            if (token != _generation || _disposed) return;
            _cueBusy = false;
            if (!ok) await OnNotice.InvokeAsync("聲音暫時無法播放，可以看描線繼續練習。");
            await OnBusy.InvokeAsync(false);
            StateHasChanged();
        }
    }

    private void StartPractice() => (_started, _pendingCanvas, _pendingCue) = (true, true, true);

    [JSInvokable]
    public async Task DrawingStarted(int token)
    {
        if (token != _generation || _disposed || Suspended || _cueBusy || !_started) return;
        _feedback = "很好，繼續畫到終點。";
        await OnStarted.InvokeAsync();
        if (!_disposed) StateHasChanged();
    }

    [JSInvokable]
    public async Task SubmitStroke(InkPoint[] points, int token)
    {
        if (token != _generation || _disposed || Suspended || _cueBusy || _submitting || !_started || _session is null || _session.IsComplete) return;
        if (BeforeSubmit is not null && !await BeforeSubmit()) return;
        if (token != _generation || _disposed) return;
        _submitting = true;
        var session = _session;
        var result = session.Submit(new(points), Relaxed);
        _feedbackGood = result.Passed;
        if (result.Passed && session.IsComplete)
        {
            _feedback = "全部完成！";
            await OnCompleted.InvokeAsync();
        }
        else
        {
            _feedback = result.Passed ? CurrentStroke.Instruction : result.Reason switch
            {
                "wrong-direction" => "方向反囉，從橘色圓點開始。",
                "incomplete" => "差一點點，再畫到線的終點。",
                "out-of-bounds" => "小手回到方框裡，再試一次。",
                "scribble" => "用一筆慢慢畫，不要來回塗喔。",
                _ => "靠近淡淡的線，再試一次。"
            };
            await OnBusy.InvokeAsync(true);
            if (token != _generation || _disposed) return;
            _cueBusy = true;
            StateHasChanged();
            await _module!.InvokeVoidAsync("clearInk");
            var audio = result.Passed ? CurrentStroke.Audio : result.Reason == "wrong-direction" ? "audio/direction.mp3" : result.Reason == "incomplete" ? "audio/short.mp3" : "audio/shape.mp3";
            await _module!.InvokeAsync<bool>("requiredCue", session.CurrentStroke, Muted ? Array.Empty<string>() : new[] { audio }, token);
            if (token != _generation || _disposed) return;
            _cueBusy = false;
            await OnBusy.InvokeAsync(false);
        }
        if (token == _generation && !_disposed) { _submitting = false; StateHasChanged(); }
    }

    private async Task ReplayStroke()
    {
        if (_module is null || _cueBusy || Suspended) return;
        await _module.InvokeVoidAsync("replayDemo", -1);
        await PlayPronunciation(CurrentStroke.Audio);
    }
    private Task PlayPronunciation() => PlayPronunciation(Symbol.Audio);
    private async Task PlayPronunciation(string audio)
    {
        if (_module is not null && !Muted) await _module.InvokeAsync<bool>("playAudio", audio);
    }
    private async Task ClearInk()
    {
        if (_module is not null) await _module.InvokeVoidAsync("clearInk");
    }
    private async Task Cancel()
    {
        var old = _generation;
        _generation = Interlocked.Increment(ref _nextGeneration);
        _pendingCanvas = _pendingCue = _submitting = _cueBusy = false;
        if (_module is not null) await _module.InvokeVoidAsync("cancelOwner", old);
    }
    public async ValueTask DisposeAsync()
    {
        _disposed = true;
        await Cancel();
        _self?.Dispose();
        if (_module is not null) await _module.DisposeAsync();
    }
}
