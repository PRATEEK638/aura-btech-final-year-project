from PIL import Image, ImageDraw
from pathlib import Path

# A code-drawn brand mark, rendered at high resolution for clean desktop icons.
size = 1024
image = Image.new('RGBA', (size,size), (0,0,0,0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((35,35,989,989),radius=235,fill='#11101e',outline='#594270',width=5)
mask=Image.new('L',(size,size),0)
pen=ImageDraw.Draw(mask)
pen.polygon([(232,758),(442,262),(578,262),(787,758),(644,758),(508,414),(370,758)],fill=255)
pen.polygon([(394,621),(619,621),(659,718),(354,718)],fill=255)
gradient=Image.new('RGBA',(size,size))
pixels=gradient.load()
for y in range(size):
    t=y/(size-1)
    color=(int(219-95*t),int(199-100*t),int(255-34*t),255)
    for x in range(size):pixels[x,y]=color
image.paste(gradient,(0,0),mask)
Path('build').mkdir(exist_ok=True)
image.save('build/icon.png')
image.save('build/icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
