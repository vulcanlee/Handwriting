"""建立可重現的逐筆教材；教育部來源解壓至 .cache/materials/extracted。"""
import json, re, shutil
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/Handwriting.Client/wwwroot'
DATA = OUT / 'data'
DATA.mkdir(parents=True, exist_ok=True)
(OUT / 'audio').mkdir(exist_ok=True)

# 原創非連筆教學字形：每個分號代表一次落筆，0..100 共用座標。
LATIN = {
'0':'M50 18 C15 18 15 82 50 82 C85 82 85 18 50 18',
'1':'M38 30 L50 18 L50 82',
'2':'M25 32 C30 10 75 10 75 34 C75 48 40 68 25 82 L78 82',
'3':'M25 23 C65 5 90 40 50 48 C90 48 82 95 25 78',
'4':'M62 18 L25 60 L80 60;M62 18 L62 82',
'5':'M75 18 L30 18 L28 48 C80 30 95 90 28 80',
'6':'M70 18 C35 14 20 60 30 74 C48 98 85 72 70 52 C58 35 29 49 28 65',
'7':'M25 18 L78 18 L42 82',
'8':'M50 18 C10 18 20 42 50 50 C90 60 82 82 50 82 C10 82 12 58 50 50 C90 38 85 18 50 18',
'9':'M72 39 C70 10 28 12 28 38 C28 65 70 63 72 39 L72 65 Q70 86 35 82',
'A':'M20 80 L50 20 L80 80;M32 56 L68 56',
'B':'M25 20 L25 80;M25 20 C85 15 85 52 25 50 C92 45 92 85 25 80',
'C':'M78 28 C15 -2 10 99 78 72',
'D':'M25 20 L25 80;M25 20 C98 12 98 88 25 80',
'E':'M75 20 L25 20 L25 80 L75 80;M25 50 L65 50',
'F':'M75 20 L25 20 L25 80;M25 50 L65 50',
'G':'M78 28 C15 -2 10 99 78 72 L78 52 L55 52',
'H':'M25 20 L25 80;M75 20 L75 80;M25 50 L75 50',
'I':'M30 20 L70 20;M50 20 L50 80;M30 80 L70 80',
'J':'M70 20 L70 65 C70 88 25 89 25 66',
'K':'M25 20 L25 80;M75 20 L25 52 L78 80',
'L':'M25 20 L25 80 L75 80',
'M':'M20 80 L20 20 L50 60 L80 20 L80 80',
'N':'M25 80 L25 20 L75 80 L75 20',
'O':'M50 20 C12 20 12 80 50 80 C88 80 88 20 50 20',
'P':'M25 20 L25 80;M25 20 C90 12 90 60 25 52',
'Q':'M50 20 C12 20 12 80 50 80 C88 80 88 20 50 20;M57 62 L82 85',
'R':'M25 20 L25 80;M25 20 C90 12 90 60 25 52 L80 80',
'S':'M75 28 C30 0 7 43 50 50 C98 58 73 100 25 72',
'T':'M20 20 L80 20;M50 20 L50 80',
'U':'M25 20 L25 60 C25 88 75 88 75 60 L75 20',
'V':'M20 20 L50 80 L80 20',
'W':'M15 20 L30 80 L50 40 L70 80 L85 20',
'X':'M25 20 L75 80;M75 20 L25 80',
'Y':'M25 20 L50 50 L75 20;M50 50 L50 80',
'Z':'M25 20 L75 20 L25 80 L75 80',
'a':'M68 40 C20 20 18 80 50 80 Q68 80 68 60 L68 40 L68 80',
'b':'M30 20 L30 80;M30 50 C85 15 90 95 30 75',
'c':'M70 44 C20 20 15 95 70 75',
'd':'M68 44 C20 20 18 80 48 80 Q68 80 68 60;M68 20 L68 80',
'e':'M25 58 L73 58 C72 20 22 30 25 60 C25 84 58 86 73 74',
'f':'M70 22 Q45 10 43 38 L43 80;M25 43 L68 43',
'g':'M68 44 C20 20 18 78 48 78 Q68 78 68 58 L68 40 L68 82 Q65 100 32 90',
'h':'M30 20 L30 80;M30 53 C35 30 70 30 70 55 L70 80',
'i':'M50 40 L50 80;M50 22 L50 25',
'j':'M60 40 L60 80 Q60 98 35 89;M60 22 L60 25',
'k':'M30 20 L30 80;M72 40 L32 60 L75 80',
'l':'M50 20 L50 80',
'm':'M20 40 L20 80;M20 53 Q32 27 48 48 L48 80;M48 53 Q65 25 80 48 L80 80',
'n':'M28 40 L28 80;M28 53 Q48 23 72 47 L72 80',
'o':'M50 38 C18 38 18 80 50 80 C82 80 82 38 50 38',
'p':'M30 40 L30 94;M30 48 C83 16 90 94 30 73',
'q':'M68 44 C20 20 18 80 48 80 Q68 80 68 60;M68 40 L68 94',
'r':'M30 40 L30 80;M30 55 Q45 28 70 42',
's':'M70 44 C38 23 12 52 48 59 C85 66 65 93 28 75',
't':'M47 23 L47 68 Q47 87 70 77;M27 43 L70 43',
'u':'M28 40 L28 65 Q28 92 68 73 L68 40 L68 80',
'v':'M25 40 L50 80 L75 40',
'w':'M15 40 L30 80 L50 50 L70 80 L85 40',
'x':'M25 40 L75 80;M75 40 L25 80',
'y':'M25 40 L50 78;M75 40 L42 94',
'z':'M25 40 L75 40 L25 80 L75 80'
}

def sample(path):
    tokens = re.findall(r'[MLQC]|-?\d+(?:\.\d+)?', path)
    points=[]; i=0; current=(0,0)
    while i<len(tokens):
        cmd=tokens[i]; i+=1
        n={'M':2,'L':2,'Q':4,'C':6}[cmd]
        nums=list(map(float,tokens[i:i+n])); i+=n
        end=tuple(nums[-2:]); start=current
        if cmd=='M': points.append(end)
        else:
            for j in range(1,25):
                t=j/24; u=1-t
                if cmd=='L': p=tuple(u*start[k]+t*end[k] for k in range(2))
                elif cmd=='Q': p=tuple(u*u*start[k]+2*u*t*nums[k]+t*t*end[k] for k in range(2))
                else: p=tuple(u**3*start[k]+3*u*u*t*nums[k]+3*u*t*t*nums[k+2]+t**3*end[k] for k in range(2))
                points.append(p)
        current=end
    return points

def stroke(points,path=None):
    dx=points[1][0]-points[0][0]; dy=points[1][1]-points[0][1]
    direction=('right' if dx>=0 else 'left') if abs(dx)>abs(dy) else ('down' if dy>=0 else 'up')
    words={'right':'往右','left':'往左','down':'往下','up':'往上'}
    return {'path':path or 'M'+' L'.join(f'{x:.3f} {y:.3f}' for x,y in points),
            'points':[{'x':round(x,4),'y':round(y,4)} for x,y in points],
            'instruction':f'從圓點開始，{words[direction]}，沿著線慢慢畫到終點。','audio':f'audio/{direction}.mp3'}

symbols=[]
for glyph,paths in LATIN.items():
    category='numbers' if glyph.isdigit() else ('upper' if glyph.isupper() else 'lower')
    symbols.append({'id':f'{category}-{glyph}','glyph':glyph,'category':category,'order':sum(s['category']==category for s in symbols),
                    'strokes':[stroke(sample(p),p) for p in paths.split(';')],
                    'audio':f'audio/{"number-"+glyph if glyph.isdigit() else "letter-"+glyph.upper()}.mp3'})

source=ROOT/'.cache/materials/extracted'
for i,code in enumerate(range(0x3105,0x312a)):
    xml=next(source.rglob(f'{code:04x}.xml'))
    raw=[[(float(p.attrib['x']),float(p.attrib['y'])) for p in s.findall('Track/*')] for s in ET.parse(xml).getroot().findall('Stroke')]
    # Preserve MOE proportions in a 2048-unit writing square.
    strokes=[stroke([(10+x/2048*80,10+y/2048*80) for x,y in pts]) for pts in raw]
    symbols.append({'id':f'zhuyin-{code:x}','glyph':chr(code),'category':'zhuyin','order':i,'strokes':strokes,'audio':f'audio/zhuyin-{i+1}.wav'})
    shutil.copyfile(source/f'audio/F{i+1}.WAV',OUT/f'audio/zhuyin-{i+1}.wav')
shutil.copyfile(source/'license.txt',DATA/'moe-license.txt')
(DATA/'symbols.json').write_text(json.dumps(symbols,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
assert len(symbols)==99
assert all(len(s['strokes'])>0 and all(len(p['points'])>=2 for p in s['strokes']) for s in symbols)
print(f'Built {len(symbols)} symbols, {sum(len(s["strokes"]) for s in symbols)} strokes.')
