"""Minimal Word document adapter using Python's standard library only."""
import io, json, sys, zipfile
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from xml.etree import ElementTree as ET
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def read(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if sum(x.file_size for x in z.infolist())>10000000:raise ValueError('Expanded document exceeds 10 MB')
        root=ET.fromstring(z.read('word/document.xml'))
        return '\n'.join(''.join(p.itertext()) for p in root.iter('{'+W+'}p'))[:100000]
def run(a):
    path=Path(a['path'])
    if path.suffix.lower()!='.docx':raise ValueError('Expected a .docx document')
    if a['operation']=='read':
        if path.stat().st_size>5000000:raise ValueError('Document exceeds 5 MB')
        return {'path':str(path),'text':read(path.read_bytes()),'untrusted':True}
    if a['operation']!='write':raise ValueError('Unsupported document action')
    content=a['content']
    if len(content)>100000:raise ValueError('Document text exceeds 100 KB')
    ET.register_namespace('w',W)
    document=ET.Element('{'+W+'}document');body=ET.SubElement(document,'{'+W+'}body')
    for line in content.split('\n'):
        p=ET.SubElement(body,'{'+W+'}p');r=ET.SubElement(p,'{'+W+'}r')
        if line.startswith('#'):
            props=ET.SubElement(r,'{'+W+'}rPr');ET.SubElement(props,'{'+W+'}b')
        text=ET.SubElement(r,'{'+W+'}t');text.set('{http://www.w3.org/XML/1998/namespace}space','preserve');text.text=line
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml',ET.tostring(document,encoding='utf-8',xml_declaration=True))
    if read(data.getvalue())!=content:raise ValueError('Document validation failed')
    with path.open('xb') as f:f.write(data.getvalue())
    if read(path.read_bytes())!=content:raise ValueError('Document read-back failed')
    return {'path':str(path),'verified':True,'verification':'Word document paragraph text read back from its saved XML.'}
try:print(json.dumps({'ok':True,'data':run(json.load(sys.stdin))}))
except Exception as e:
    print(json.dumps({'ok':False,'error':str(e)}));sys.exit(1)
