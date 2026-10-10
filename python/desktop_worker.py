"""Bounded Windows controls, JSON in/out. Never executes model-provided code."""
import ctypes as c
from ctypes import wintypes as w
import json, sys
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')

u = c.WinDLL('user32', use_last_error=True)
u.SendMessageTimeoutW.argtypes = [w.HWND,w.UINT,w.WPARAM,w.LPARAM,w.UINT,w.UINT,c.POINTER(c.c_size_t)]
u.SendMessageTimeoutW.restype = w.LPARAM
u.GetWindowTextW.argtypes = [w.HWND,w.LPWSTR,c.c_int]
u.GetClassNameW.argtypes = [w.HWND,w.LPWSTR,c.c_int]
u.IsWindow.argtypes = [w.HWND]
u.IsWindowVisible.argtypes = [w.HWND]
u.GetWindowThreadProcessId.argtypes = [w.HWND,c.POINTER(w.DWORD)]
u.GetWindowLongW.argtypes = [w.HWND,c.c_int]
CALLBACK = c.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
u.EnumWindows.argtypes = [CALLBACK,w.LPARAM]
u.EnumChildWindows.argtypes = [w.HWND,CALLBACK,w.LPARAM]
EDIT_CLASSES = {'edit','richedit20w','richedit50w','richeditd2dpt','richeditd2d'}

def cls(h):
    b=c.create_unicode_buffer(256);u.GetClassNameW(h,b,256);return b.value
def title(h):
    b=c.create_unicode_buffer(1024);u.GetWindowTextW(h,b,1024);return b.value
def pid(h):
    p=w.DWORD();u.GetWindowThreadProcessId(h,c.byref(p));return p.value
def message(h,m,wp,lp):
    r=c.c_size_t()
    if not u.SendMessageTimeoutW(h,m,wp,lp,2,1200,c.byref(r)): raise ValueError('Window is unavailable or not responding')
    return r.value
def content(h):
    b=c.create_unicode_buffer(16001);message(h,13,16001,c.addressof(b));return b.value
def children(h):
    out=[]
    @CALLBACK
    def visit(ch,_):
        if len(out)>=100:return False
        if u.IsWindowVisible(ch) and not (u.GetWindowLongW(ch,-16)&0x20 and cls(ch).lower() in EDIT_CLASSES):
            kind=cls(ch); editable=kind.lower() in EDIT_CLASSES
            out.append({'handle':str(ch),'className':kind,'text':content(ch) if editable else title(ch),'editable':editable})
        return True
    u.EnumChildWindows(h,visit,0);return out
def run(a):
    if a['operation']=='windows':
        out=[]
        @CALLBACK
        def visit(h,_):
            if u.IsWindowVisible(h) and title(h):out.append({'handle':str(h),'title':title(h),'pid':pid(h)})
            return len(out)<100
        u.EnumWindows(visit,0);return out
    h=int(a['handle'])
    if not u.IsWindow(h) or pid(h)!=a['pid']:raise ValueError('Window changed; observe it again')
    if title(h)!=a['expectedTitle']:raise ValueError('Window title changed; observe it again')
    if a['operation']=='read':return {'title':title(h),'controls':children(h),'untrusted':True}
    if a['operation']=='type':
        ch=int(a['control']);matches=[x for x in children(h) if x['handle']==str(ch) and x['editable']]
        if len(matches)!=1:raise ValueError('Editable control is no longer available')
        if matches[0]['text']:raise ValueError('Refusing to overwrite existing text; use an empty document')
        text=a['content']
        if len(text)>12000:raise ValueError('Text exceeds control limit')
        if title(h)!=a['expectedTitle']:raise ValueError('Active document changed; observe it again')
        b=c.create_unicode_buffer(text);message(ch,12,0,c.addressof(b))
        actual=content(ch)
        if actual.replace('\r\n','\n')!=text.replace('\r\n','\n'):raise ValueError('Text insertion could not be verified')
        return {'verified':True,'characters':len(text),'title':title(h),'verification':'Native editable control read-back matched inserted text.'}
    raise ValueError('Unsupported desktop operation')
try:
    result=run(json.load(sys.stdin));print(json.dumps({'ok':True,'data':result}))
except Exception as e:
    print(json.dumps({'ok':False,'error':str(e)}));sys.exit(1)
