using System.Net.Http.Json;
using System.Text.Json;
using Handwriting.Core;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Handwriting.Client.Pages;

public partial class Home
{
    private readonly (string Key, string Icon, string Label)[] Categories =
        [("numbers", "123", "數字"), ("upper", "ABC", "大寫"), ("lower", "abc", "小寫"), ("zhuyin", "ㄅㄆㄇ", "注音")];
    private List<SymbolDefinition> _symbols = [];
    private Dictionary<string, PracticeProgress> _progress = [];
    private SymbolDefinition? _selected;
    private PracticeSession? _session;
    private IJSObjectReference? _module;
    private DotNetObjectReference<Home>? _self;
    private string _category = "numbers", _offlineText = "檢查離線教材中", _feedback = "從橘色圓點開始，照著淡淡的線寫。";
    private string? _notice;
    private bool _loaded, _gridOpen = true, _started, _muted, _relaxed = true, _online = true;
    private bool _submitting, _feedbackGood, _pendingCanvas, _pendingStartAudio, _disposed;
    private int _generation;
    private IEnumerable<SymbolDefinition> CategorySymbols => _symbols.Where(x => x.Category == _category).OrderBy(x => x.Order);
    private int CompletedCount => _progress.Count(x => x.Value.Completed && _symbols.Any(s => s.Id == x.Key));
    private StrokeDefinition CurrentStroke => _selected!.Strokes[_session!.CurrentStroke];
    private PracticeProgress ProgressFor(SymbolDefinition symbol) => _progress.TryGetValue(symbol.Id, out var progress) ? progress : new();

    protected override async Task OnInitializedAsync()
    {
        try { _symbols = await Http.GetFromJsonAsync<List<SymbolDefinition>>("data/symbols.json") ?? []; }
        catch { _notice = "練習資料暫時讀不到，請重新連線並重新載入。"; }
        _loaded = true;
    }

    protected override async Task OnAfterRenderAsync(bool first)
    {
        if (first)
        {
            _module = await JS.InvokeAsync<IJSObjectReference>("import", "./js/practice.js");
            _self = DotNetObjectReference.Create(this);
            SavedState saved;
            try { saved = await _module.InvokeAsync<SavedState>("loadState"); }
            catch (Exception error) when (error is JSException or JsonException)
            {
                // JS dates and .NET DateTimeOffset have different validation rules.
                saved = new SavedState { Malformed = true };
            }
            _muted = saved.Muted;
            _relaxed = saved.Relaxed;
            _progress = saved.Progress ?? [];
            if (saved.Malformed) await SaveState();
            if (saved.Malformed) _notice = "先前的練習紀錄有點亂，已幫你重新開始。";
            if (!saved.Available) _notice = "這個瀏覽器無法保存進度，這次仍可以繼續練習。";
            await _module.InvokeVoidAsync("watchOffline", _self);
            StateHasChanged();
            return;
        }
        if (_module is null || _disposed) return;
        if (_pendingCanvas)
        {
            _pendingCanvas = false;
            await _module.InvokeVoidAsync("initCanvas", "practice-canvas", _self, _generation);
            await _module.InvokeVoidAsync("replayDemo", _pendingStartAudio ? -1 : _session!.CurrentStroke);
        }
        if (_pendingStartAudio)
        {
            _pendingStartAudio = false;
            if (!_muted && _selected is not null && _session is { IsComplete: false })
            {
                var token = _generation;
                var ok = await _module.InvokeAsync<bool>("playSequence", new object[] { new[] { _selected.Audio, CurrentStroke.Audio } });
                if (!ok && token == _generation)
                {
                    _notice = "瀏覽器沒有播放聲音；可以再按一次喇叭試試看。";
                    StateHasChanged();
                }
            }
        }
    }

    private async Task SelectCategory(string key)
    {
        _category = key;
        _gridOpen = true;
        await ResetSelection();
    }

    private async Task SelectSymbol(SymbolDefinition symbol)
    {
        await CancelInteraction();
        _selected = symbol;
        _session = new(symbol, ProgressFor(symbol));
        _progress[symbol.Id] = _session.Progress;
        _started = false;
        _feedback = "從橘色圓點開始，照著淡淡的線寫。";
        _feedbackGood = false;
    }

    private async Task ResetSelection()
    {
        await CancelInteraction();
        _selected = null;
        _session = null;
        _started = false;
    }

    private void StartPractice() => (_started, _pendingCanvas, _pendingStartAudio) = (true, true, true);

    private async Task PracticeAgain()
    {
        await CancelInteraction();
        _session!.Reset();
        _feedback = "再來一次，你會越寫越順！";
        _pendingCanvas = _pendingStartAudio = true;
    }

    private async Task NextSymbol()
    {
        if (_session?.IsComplete != true) return;
        var next = CategorySymbols.FirstOrDefault(s => s.Order > _selected!.Order);
        if (next is null) { await ResetSelection(); _gridOpen = true; }
        else await SelectSymbol(next);
    }

    private async Task ChangeMode(ChangeEventArgs e)
    {
        _relaxed = e.Value?.ToString() != "standard";
        await SaveState();
        await CancelInteraction();
        if (_started && _session is { IsComplete: false }) _pendingCanvas = true;
    }

    private async Task ToggleMute()
    {
        _muted = !_muted;
        if (_muted && _module is not null) await _module.InvokeVoidAsync("stopAudio");
        await SaveState();
    }

    private async Task ReplayStroke()
    {
        if (_module is null) return;
        await _module.InvokeVoidAsync("replayDemo", -1);
        await Play(CurrentStroke.Audio);
    }
    private Task PlayPronunciation() => Play(_selected!.Audio);

    private async Task Play(string path)
    {
        if (_module is null || _muted) return;
        var token = _generation;
        var ok = await _module.InvokeAsync<bool>("playAudio", path);
        if (!ok && token == _generation) _notice = "瀏覽器沒有播放聲音；可以再按一次喇叭試試看。";
    }

    private async Task ClearInk()
    {
        if (_module is not null) await _module.InvokeVoidAsync("clearInk");
        _feedback = "從橘色圓點開始，慢慢寫。";
        _feedbackGood = false;
    }

    private async Task CancelInteraction()
    {
        _submitting = _pendingCanvas = _pendingStartAudio = false;
        _generation++;
        if (_module is not null) await _module.InvokeVoidAsync("cancel", _generation);
    }

    private async Task SaveState()
    {
        if (_module is not null && !await _module.InvokeAsync<bool>("saveState", new SavedState { Progress = _progress, Muted = _muted, Relaxed = _relaxed }))
            _notice = "無法保存進度，這次仍可以繼續練習。";
    }
    private async Task RetryOffline() { if (_module is not null) await _module.InvokeVoidAsync("retryOffline"); }

    [JSInvokable]
    public Task DrawingStarted(int token)
    {
        if (token == _generation) { _feedback = "很好，繼續畫到終點。"; _feedbackGood = false; StateHasChanged(); }
        return Task.CompletedTask;
    }

    [JSInvokable]
    public async Task SubmitStroke(InkPoint[] points, int token)
    {
        if (token != _generation || !_started || _session is null || _session.IsComplete || _disposed) return;
        var session = _session;
        _submitting = true;
        var result = session.Submit(new StrokeAttempt(points), _relaxed);
        _submitting = false;
        _feedbackGood = result.Passed;
        if (result.Passed)
        {
            _feedback = session.IsComplete ? "全部完成！" : CurrentStroke.Instruction;
            _pendingCanvas = !session.IsComplete;
            await SaveState();
            if (token != _generation) return;
            await Play(session.IsComplete ? "audio/success.mp3" : CurrentStroke.Audio);
        }
        else
        {
            _feedback = MessageFor(result.Reason);
            if (_module is not null)
            {
                await _module.InvokeVoidAsync("clearInk");
                if (token != _generation) return;
                await _module.InvokeVoidAsync("replayDemo", session.CurrentStroke);
            }
            if (token != _generation) return;
            await Play(AudioFor(result.Reason));
        }
        if (!_disposed && token == _generation) StateHasChanged();
    }

    [JSInvokable]
    public Task OfflineChanged(bool online, string message)
    {
        if (!_disposed) { _online = online; _offlineText = message; StateHasChanged(); }
        return Task.CompletedTask;
    }
    private static string MessageFor(string reason) => reason switch
    {
        "wrong-direction" => "方向反囉，從橘色圓點開始。",
        "incomplete" => "差一點點，再畫到線的終點。",
        "out-of-bounds" => "小手回到方框裡，再試一次。",
        "scribble" => "用一筆慢慢畫，不要來回塗喔。",
        _ => "靠近淡淡的線，再試一次。"
    };
    private static string AudioFor(string reason) => reason switch
    {
        "wrong-direction" => "audio/direction.mp3", "incomplete" => "audio/short.mp3", _ => "audio/shape.mp3"
    };
    public async ValueTask DisposeAsync()
    {
        _disposed = true;
        if (_module is not null) { await _module.InvokeVoidAsync("dispose"); await _module.DisposeAsync(); }
        _self?.Dispose();
    }
    public sealed class SavedState
    {
        public Dictionary<string, PracticeProgress>? Progress { get; set; } = [];
        public bool Muted { get; set; }
        public bool Relaxed { get; set; } = true;
        public bool Malformed { get; set; }
        public bool Available { get; set; } = true;
    }
}
