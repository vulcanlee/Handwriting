using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using Handwriting.Core;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Handwriting.Client.Pages;

public partial class Home
{
    private List<SymbolDefinition> _symbols = [];
    private List<BadgeDefinition> _badges = [];
    private AdventureState _state = new();
    private ChildProfile? Child => _state.Children.FirstOrDefault(c => c.Id == _state.ActiveChildId);
    private IJSObjectReference? _store, _practice;
    private DotNetObjectReference<Home>? _self;
    private readonly CancellationTokenSource _stop = new();
    private Task? _ticker;
    private bool _loaded, _writer, _disposed, _editing, _newChild, _timed, _boardBusy = true, _freePaused;
    private string _page = "practice", _category = "numbers", _name = "", _avatar = "numbers", _offlineText = "檢查離線教材中";
    private string? _notice, _profileError;
    private int _count = 5, _sequence;
    private readonly HashSet<string> _selectedCategories = ["numbers"];
    private SymbolDefinition? _symbol;
    private ChallengeRun? _run;
    private List<BadgeDefinition> _earned = [];
    private bool _questionCredited;
    private static double Now => (double)Stopwatch.GetTimestamp() / Stopwatch.Frequency;
    private string BoardKey => $"{Child?.Id}-{_sequence}";
    private string ClockText => TimeSpan.FromSeconds(Math.Ceiling(_run?.Remaining(Now) ?? 0)).ToString(@"mm\:ss");
    private string ResultTitle => _run?.Status switch { "passed" => "探險成功！", "timeout" => "時間到了，辛苦小手了！", _ => "這次先休息，隨時再出發！" };

    protected override async Task OnInitializedAsync()
    {
        try { _symbols = await Http.GetFromJsonAsync<List<SymbolDefinition>>("data/symbols.json") ?? []; _badges = BadgeCatalog.Create(_symbols); }
        catch { _notice = "教材讀取失敗，請重新連線並重新載入。"; }
    }
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;
        _store = await JS.InvokeAsync<IJSObjectReference>("import", "./js/adventure.js");
        _practice = await JS.InvokeAsync<IJSObjectReference>("import", "./js/practice.js");
        _self = DotNetObjectReference.Create(this);
        _writer = await _store.InvokeAsync<bool>("acquireWriter");
        LoadedAdventure loaded;
        try { loaded = await _store.InvokeAsync<LoadedAdventure>("loadAdventure"); }
        catch (Exception error) when (error is JSException or JsonException)
        {
            loaded = new() { Malformed = true };
        }
        _state = loaded.State;
        if (loaded.Malformed) { _writer = false; _notice = "保存資料格式異常，已保留原始資料，請由家長協助檢查，避免覆蓋成果。"; }
        else if (!_writer) _notice = "另一個分頁正在使用，請關閉其他分頁後重新載入。本功能需要支援 Web Locks 的 HTTPS 或 localhost 瀏覽器。";
        else if (!loaded.Available) _notice = "瀏覽器無法保存資料，這次成果會暫存在記憶體，關閉後可能遺失。";
        if (Child is null && _state.Children.Count > 0) _state.ActiveChildId = _state.Children[0].Id;
        _editing = _newChild = _state.Children.Count == 0;
        await _practice.InvokeVoidAsync("watchOffline", _self);
        await _store.InvokeVoidAsync("watchVisibility", _self);
        _loaded = true;
        _ticker = Tick();
        StateHasChanged();
    }
    private async Task Tick()
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        try
        {
            while (await timer.WaitForNextTickAsync(_stop.Token))
                await InvokeAsync(() => { if (_run is { Status: "playing" }) { _run.Check(Now); StateHasChanged(); } });
        }
        catch (OperationCanceledException) { }
    }
    private async Task Save()
    {
        if (_writer && _store is not null && !await _store.InvokeAsync<bool>("saveAdventure", _state))
            _notice = "成果尚未保存：瀏覽器空間或儲存權限不足。這次仍可練習，請先不要關閉網站。";
    }
    private void Award(bool imported = false)
    {
        if (Child is null) return;
        var newly = BadgeCatalog.Award(Child, _badges, imported);
        if (!imported) _earned.AddRange(newly);
    }
    private async Task StopInteraction()
    {
        _run?.Abort(Now);
        _symbol = null;
        _sequence++;
        _freePaused = false;
        if (_practice is not null) await _practice.InvokeVoidAsync("stopAudio");
    }
    private async Task Navigate(string page)
    {
        await StopInteraction();
        _run = null;
        _earned = [];
        _page = page;
    }
    private async Task SwitchChild(ChangeEventArgs args)
    {
        await StopInteraction();
        _run = null;
        _earned = [];
        _state.ActiveChildId = args.Value?.ToString();
        _editing = false;
        await Save();
    }
    private async Task EditChild(bool create)
    {
        await StopInteraction(); _run = null;
        _newChild = create; _editing = true; _profileError = null;
        _name = create ? "" : Child?.Name ?? "";
        _avatar = create ? "numbers" : Child?.Avatar ?? "numbers";
    }
    private async Task SaveChild()
    {
        if (!_writer) return;
        var name = _name.Trim();
        if (name.Length is < 1 or > 20) { _profileError = "請輸入 1 到 20 個字的暱稱。"; return; }
        if (_newChild)
        {
            var child = new ChildProfile { Name = name, Avatar = _avatar };
            if (_state.Children.Count == 0 && _state.LegacyProgress is not null)
            {
                child.Progress = _state.LegacyProgress;
                foreach (var symbol in _symbols)
                    if (child.Progress.TryGetValue(symbol.Id, out var p) && (p.Completed || p.SuccessfulAttempts > 0 || p.LastPracticed is not null)) child.StartedCategories.Add(symbol.Category);
            }
            _state.Children.Add(child); _state.ActiveChildId = child.Id;
            Award(true); _state.LegacyProgress = null;
        }
        else if (Child is not null) { Child.Name = name; Child.Avatar = _avatar; }
        _editing = false; _earned = []; await Save();
    }
    private async Task SelectCategory(string category)
    {
        await StopInteraction(); _category = category;
    }
    private void SelectSymbol(SymbolDefinition symbol)
    {
        _symbol = symbol; _sequence++; _questionCredited = false; _boardBusy = true; _freePaused = false;
    }
    private void Again() { if (_symbol is not null) SelectSymbol(_symbol); }
    private void Next()
    {
        if (_symbol is null) return;
        var next = _symbols.FirstOrDefault(s => s.Category == _category && s.Order > _symbol.Order);
        if (next is null) _symbol = null; else SelectSymbol(next);
    }
    private async Task ChangeMode(ChangeEventArgs e)
    {
        _state.Relaxed = e.Value?.ToString() != "standard";
        if (_symbol is not null) SelectSymbol(_symbol);
        await Save();
    }
    private async Task ToggleMute()
    {
        _state.Muted = !_state.Muted;
        if (_state.Muted && _practice is not null) await _practice.InvokeVoidAsync("stopAudio");
        await Save();
    }
    private void ChangeChallengeMode(ChangeEventArgs e) => _timed = e.Value?.ToString() == "timed";
    private void ToggleCategory(string key)
    {
        if (!_selectedCategories.Remove(key)) _selectedCategories.Add(key);
    }
    private void StartChallenge()
    {
        if (Child is null || !_writer || _selectedCategories.Count == 0) return;
        _earned = [];
        _run = new(ChallengeRun.Draw(_symbols, _selectedCategories.ToArray(), _count, Random.Shared), _timed, _state.Relaxed);
        SelectSymbol(_run.Questions[0]);
    }
    private Task<bool> BeforeSubmit()
    {
        var allowed = _writer && !_boardBusy && !_freePaused && (_run is null || _run.Check(Now));
        if (!allowed) StateHasChanged();
        return Task.FromResult(allowed);
    }
    private async Task Started()
    {
        if (!_writer || Child is null || _symbol is null || !await BeforeSubmit()) return;
        if (Child.StartedCategories.Add(_symbol.Category)) { Award(); await Save(); }
    }
    private Task Busy(bool busy)
    {
        _boardBusy = busy;
        _run?.SetWorking(!busy, Now);
        return Task.CompletedTask;
    }
    private async Task Completed()
    {
        if (!_writer || Child is null || _symbol is null || _questionCredited) return;
        var run = _run;
        if (run is not null && !run.CompleteQuestion(run.Completed, Now)) return;
        _questionCredited = true;
        var child = Child;
        var symbol = _symbol;
        if (!child.Progress.TryGetValue(symbol.Id, out var p)) child.Progress[symbol.Id] = p = new();
        p.Completed = true;
        if (p.SuccessfulAttempts < int.MaxValue) p.SuccessfulAttempts++;
        p.LastPracticed = DateTimeOffset.UtcNow;
        child.StartedCategories.Add(symbol.Category);
        run?.Settle(child);
        Award();
        await Save();
        if (Child != child || _disposed || _run != run) return;
        if (run is { Status: "playing" }) SelectSymbol(run.Questions[run.Completed]);
        else if (_practice is not null && !_state.Muted)
            await _practice.InvokeAsync<bool>("playAudio", _earned.Count > 0 ? "audio/badges/earned.mp3" : "audio/success.mp3");
    }
    private void Pause()
    {
        _run?.Pause(Now);
        if (_run is null) _freePaused = true;
    }
    private void Resume()
    {
        _boardBusy = true;
        _run?.Resume(Now); _freePaused = false;
    }
    private async Task Abort()
    {
        _run?.Abort(Now);
        if (_practice is not null) await _practice.InvokeVoidAsync("stopAudio");
    }
    [JSInvokable] public Task WentToBackground() { Pause(); StateHasChanged(); return Task.CompletedTask; }
    [JSInvokable] public Task OfflineChanged(bool online, string message) { _offlineText = message; if (!_disposed) StateHasChanged(); return Task.CompletedTask; }
    private Task Notice(string text) { _notice = text; return Task.CompletedTask; }
    private async Task RetryOffline() { if (_practice is not null) await _practice.InvokeVoidAsync("retryOffline"); }
    private async Task PlayBadge(BadgeDefinition badge) { if (!_state.Muted && _practice is not null) await _practice.InvokeAsync<bool>("playAudio", badge.Audio); }
    private async Task StopBadgeAudio() { if (_practice is not null) await _practice.InvokeVoidAsync("stopAudio"); }
    public async ValueTask DisposeAsync()
    {
        _disposed = true; _stop.Cancel();
        if (_ticker is not null) await _ticker;
        if (_practice is not null) { await _practice.InvokeVoidAsync("dispose"); await _practice.DisposeAsync(); }
        if (_store is not null) { await _store.InvokeVoidAsync("dispose"); await _store.DisposeAsync(); }
        _self?.Dispose(); _stop.Dispose();
    }
    public sealed class LoadedAdventure
    {
        public AdventureState State { get; set; } = new();
        public bool Available { get; set; }
        public bool Malformed { get; set; }
    }
}
