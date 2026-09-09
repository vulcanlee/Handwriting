"""驗證實際交付教材、筆畫與離線音檔完整性。"""
import json, math, wave
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'src/Handwriting.Client/wwwroot'
symbols=json.loads((root/'data/symbols.json').read_text(encoding='utf-8'))
assert len(symbols)==99 and len({s['id'] for s in symbols})==99
expected={'numbers':'0123456789','upper':'ABCDEFGHIJKLMNOPQRSTUVWXYZ','lower':'abcdefghijklmnopqrstuvwxyz','zhuyin':''.join(map(chr,range(0x3105,0x312a)))}
for category,glyphs in expected.items():
    group=sorted((s for s in symbols if s['category']==category),key=lambda s:s['order'])
    assert ''.join(s['glyph'] for s in group)==glyphs
for s in symbols:
    assert (root/s['audio']).stat().st_size>1000, s['id']
    assert s['strokes']
    for stroke in s['strokes']:
        assert stroke['instruction'] and stroke['path'].startswith('M')
        assert (root/stroke['audio']).stat().st_size>1000
        assert len(stroke['points'])>=2
        assert all(math.isfinite(p[c]) and 0<=p[c]<=100 for p in stroke['points'] for c in ['x','y'])
for p in (root/'audio').glob('*.wav'):
    with wave.open(str(p)) as audio: assert audio.getnframes()/audio.getframerate()>0.1
for name in ['start','direction','short','shape','success','next','empty']:
    assert (root/f'audio/{name}.mp3').stat().st_size>1000
print(f'教材檢查通過：{len(symbols)} 個符號、{sum(len(s["strokes"]) for s in symbols)} 筆、全部必要音檔存在。')
