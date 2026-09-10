"""從核心匯出的 badges.json 製作本專案原創 SVG、預製離線條件語音與 PRD 規格表。"""
import argparse
import asyncio
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'src/Handwriting.Client/wwwroot'


def animal(category):
    eyes = '<circle cx="76" cy="98" r="4" fill="#263f3c"/><circle cx="124" cy="98" r="4" fill="#263f3c"/><path d="M90 116 Q100 128 110 116" fill="none" stroke="#263f3c" stroke-width="4" stroke-linecap="round"/>'
    if category == 'numbers':
        return '<ellipse cx="76" cy="54" rx="15" ry="34" fill="#fff6e8"/><ellipse cx="124" cy="54" rx="15" ry="34" fill="#fff6e8"/><ellipse cx="76" cy="53" rx="6" ry="22" fill="#efb6a4"/><ellipse cx="124" cy="53" rx="6" ry="22" fill="#efb6a4"/><ellipse cx="100" cy="104" rx="53" ry="43" fill="#fff6e8"/>' + eyes
    if category == 'upper':
        return '<path d="M100 32 116 44 136 41 143 60 162 69 158 90 169 107 155 123 152 143 131 146 116 161 98 151 79 160 64 146 44 143 43 123 30 105 43 86 41 66 61 58 67 40 86 44Z" fill="#bb713e"/><circle cx="100" cy="98" r="48" fill="#ffd881"/>' + eyes
    if category == 'lower':
        return '<path d="M48 99 43 37 82 62 Q100 55 119 62 L157 37 152 99 Q157 145 100 152 Q43 145 48 99Z" fill="#ea9758"/><path d="M47 91 Q74 89 100 121 Q127 89 153 91 Q152 143 100 151 Q49 142 47 91" fill="#fff3db"/>' + eyes
    if category == 'zhuyin':
        return '<path d="M48 78 44 40 78 58 Q100 47 123 58 L156 40 151 81 Q173 153 100 158 Q27 153 48 78" fill="#718b97"/><ellipse cx="76" cy="99" rx="26" ry="30" fill="#fff3d6"/><ellipse cx="124" cy="99" rx="26" ry="30" fill="#fff3d6"/><path d="M91 118 109 118 100 130Z" fill="#e9ab44"/>' + eyes
    return ''.join(f'<g transform="translate({x} {y}) scale(.44)">{animal(c)}</g>' for c, x, y in [('numbers', 12, 12), ('upper', 98, 12), ('lower', 12, 88), ('zhuyin', 98, 88)])


def svg(body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" role="img"><title>{html.escape(title)}</title>{body}</svg>'


def generate(badges):
    colors = {'start': '#82bdb0', 'collect': '#e9b66b', 'practice': '#9d9ac7', 'wins': '#77a9c6', 'length': '#d88986'}
    animals = WEB / 'images/animals'
    images = WEB / 'images/badges'
    animals.mkdir(parents=True, exist_ok=True)
    images.mkdir(parents=True, exist_ok=True)
    for key in ['numbers', 'upper', 'lower', 'zhuyin', 'mixed']:
        (animals / f'{key}.svg').write_text(svg('<circle cx="100" cy="105" r="94" fill="#e8f4eb"/>' + animal(key), key), encoding='utf-8')
    for b in badges:
        color = colors[b['kind']]
        decoration = '<path d="M63 47 76 27 89 45 101 21 114 45 128 27 139 47" fill="#f4cc74" stroke="#8b6b3c" stroke-width="3"/>' if b['target'] >= 10 else '<path d="m153 47 4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 10-1Z" fill="#f4cc74"/>'
        mode = '<circle cx="155" cy="145" r="17" fill="#fffaf0" stroke="#476966" stroke-width="3"/><path d="M155 134v12h9" fill="none" stroke="#476966" stroke-width="3"/>' if b['mode'] == 'timed' else ''
        kind = {'start': 'GO', 'collect': 'SET', 'practice': 'TRY', 'wins': 'WIN', 'length': 'LONG'}[b['kind']]
        body = f'<path d="M51 153 44 216 76 204 98 218 102 157M103 157 113 218 138 202 163 215 153 150" fill="{color}"/><circle cx="100" cy="98" r="91" fill="{color}"/><circle cx="100" cy="98" r="81" fill="#fff9e9" stroke="#ffffff" stroke-width="3"/>'
        body += f'<g transform="translate(10 8) scale(.9)">{animal(b["category"])}</g>' + decoration + mode
        body += f'<rect x="42" y="164" width="116" height="35" rx="17" fill="{color}"/><text x="100" y="188" text-anchor="middle" fill="#203f3b" font-family="sans-serif" font-weight="bold" font-size="19">{kind} {b["target"]}</text>'
        (images / f'{b["id"]}.svg').write_text(svg(body, b['name']), encoding='utf-8')
    doc = ROOT / 'docs/product/動物探險激勵系統PRD.md'
    text = doc.read_text(encoding='utf-8-sig').split('## 完整徽章規格')[0].rstrip()
    text = text.replace('完整 88 枚的固定識別碼、名稱、條件與門檻於實作目錄產生後列在本文末表格。', '完整 88 枚的固定識別碼、名稱、條件與門檻列於文末，由核心規則匯出。')
    text += '\n\n## 完整徽章規格\n\n| 識別碼 | 名稱 | 分類 | 取得條件 |\n|---|---|---|---|\n'
    text += '\n'.join(f'| {b["id"]} | {b["name"]} | {b["group"]} | {b["condition"]} |' for b in badges) + '\n'
    doc.write_bytes(('\ufeff' + text.replace('\n', '\r\n')).encode('utf-8'))


async def audio(badges):
    import edge_tts
    out = WEB / 'audio/badges'
    out.mkdir(parents=True, exist_ok=True)
    jobs = [(b['id'], b['condition']) for b in badges] + [('earned', '新徽章入袋！每一筆努力都有收穫，你做到了！')]
    semaphore = asyncio.Semaphore(3)
    async def save(key, text):
        path = out / f'{key}.mp3'
        if path.exists() and path.stat().st_size > 1000:
            return
        async with semaphore:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(text, 'zh-TW-HsiaoChenNeural', rate='-15%').save(str(path))
                    print(key, flush=True)
                    return
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2)
    await asyncio.gather(*(save(*job) for job in jobs))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio', action='store_true')
    args = parser.parse_args()
    badges = json.loads((WEB / 'data/badges.json').read_text(encoding='utf-8'))
    generate(badges)
    print(f'已產生 {len(badges)} 枚原創徽章與 PRD 規格表。', flush=True)
    if args.audio:
        asyncio.run(audio(badges))
