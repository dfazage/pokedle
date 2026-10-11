import json,sys
from PIL import Image
d=json.load(open(sys.argv[1]))
cols=10; rows=(len(d)+cols-1)//cols
im=Image.new('RGB',(cols*70,rows*70),(150,200,120))
for i,e in enumerate(d):
    t=Image.new('RGBA',(64,64),(0,0,0,0))
    for j,v in enumerate(e['px']):
        if v: t.putpixel((j%64,j//64),tuple(e['pal'][str(v)])+(255,))
    im.paste(t,((i%cols)*70+3,(i//cols)*70+3),t)
im=im.resize((im.width*2,im.height*2),Image.NEAREST); im.save(sys.argv[2])
