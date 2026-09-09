"""預製離線語音：python -m pip install edge-tts==7.2.8。"""
import asyncio
from pathlib import Path
import edge_tts

OUT=Path(__file__).resolve().parents[1]/'src/Handwriting.Client/wwwroot/audio'
TEXT={
 'right':'從圓點開始，往右，沿著線慢慢畫到終點。',
 'left':'從圓點開始，往左，沿著線慢慢畫到終點。',
 'down':'從圓點開始，往下，沿著線慢慢畫到終點。',
 'up':'從圓點開始，往上，沿著線慢慢畫到終點。',
 'start':'從彩色圓點開始，再試一次。',
 'direction':'沿著箭頭的方向，再試一次。',
 'short':'再畫長一點，慢慢畫到終點。',
 'shape':'沿著淡色的線，慢慢畫，再試一次。',
 'success':'你完成了！真棒！',
 'next':'這一筆完成了！我們來畫下一筆。',
 'empty':'用手指沿著線畫一筆試試看。',
}
async def main():
    jobs=[(key,text,'zh-TW-HsiaoChenNeural') for key,text in TEXT.items()]
    jobs += [(f'number-{i}',text,'zh-TW-HsiaoChenNeural') for i,text in enumerate('零一二三四五六七八九')]
    jobs += [(f'letter-{c}',c,'en-US-JennyNeural') for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
    semaphore=asyncio.Semaphore(3)
    async def save(key,text,voice):
        target=OUT/f'{key}.mp3'
        if target.exists() and target.stat().st_size>1000:return
        async with semaphore:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(text,voice,rate='-15%').save(str(target))
                    print(key,flush=True);return
                except Exception:
                    if attempt==2:raise
                    await asyncio.sleep(2)
    await asyncio.gather(*(save(*job) for job in jobs))
asyncio.run(main())
