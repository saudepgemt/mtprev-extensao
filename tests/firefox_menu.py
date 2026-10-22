"""Exercise the real Firefox extension against an isolated local SPA fixture."""
import argparse, base64, http.server, json, mimetypes, shutil, socket, subprocess, tempfile, threading, time
from pathlib import Path
from urllib.parse import urlsplit
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--firefox', default='/usr/lib64/firefox/firefox' if Path('/usr/lib64/firefox/firefox').exists() else shutil.which('firefox'))
parser.add_argument('--store-assets', action='store_true', help='Captura a interface real com dados fictícios para a ficha da loja')
args = parser.parse_args()
if not args.firefox:
    parser.error('Informe o executavel do Firefox com --firefox')
subprocess.run(['node', str(root / 'scripts/build-firefox.js')], check=True)
with socket.socket() as port_probe:
    port_probe.bind(('127.0.0.1', 0))
    marionette_port = port_probe.getsockname()[1]
profile = Path(tempfile.mkdtemp(prefix='mtprev-firefox-ui-'))
extension = profile / 'extension'
shutil.copytree(root / 'dist/firefox', extension)
class Fixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        asset = (root / urlsplit(self.path).path.lstrip('/')).resolve()
        if args.store_assets and asset.is_file() and any(folder in asset.parents for folder in [root / 'store', root / 'images']):
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(str(asset))[0] or 'application/octet-stream')
            self.end_headers()
            self.wfile.write(asset.read_bytes())
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        content = (root / 'tests/fixtures/spa.html').read_text()
        if args.store_assets:
            content = content.replace('<h1>Caixa SPA de teste</h1>', '''<link rel="stylesheet" href="/store/demo.css">
              <header id="demo-header"><strong>Ambiente de demonstração</strong><span>MTPrev · Extensão Geral</span></header>
              <section id="demo-intro"><small>Exemplo de caixa processual</small><h1>Expedientes e processos</h1><p>A interface MTPrev reúne as ferramentas ao lado da sua caixa de trabalho.</p></section>
              <div id="demo-tabs"><strong>Expedientes</strong><span>Processos da caixa</span></div>''')
            content = content.replace('</table>', '</table><div id="demo-note">Dados fictícios usados exclusivamente para demonstrar a extensão.</div><footer id="demo-footer">MTPrev — apoio à triagem, aos relatórios e aos documentos processuais.</footer>')
        self.wfile.write(content.encode())
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = 'http://127.0.0.1:%d/procedures' % server.server_port
manifest = json.loads((extension / 'manifest.json').read_text())
manifest['host_permissions'].append('http://127.0.0.1/*')
manifest['content_scripts'][0]['matches'].append('http://127.0.0.1/*')
manifest['web_accessible_resources'][0]['matches'].append('http://127.0.0.1/*')
(extension / 'manifest.json').write_text(json.dumps(manifest))
(profile / 'user.js').write_text(f'user_pref("marionette.port", {marionette_port});\nuser_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.startup.homepage_override.mstone", "ignore");\n')
log = (profile / 'firefox.log').open('w')
proc = subprocess.Popen([args.firefox, '--headless', '--no-remote', '--profile', str(profile), '--marionette', '--remote-allow-system-access', 'about:blank'], stdout=log, stderr=log)
client = None
seq = 0

def receive():
    length = b''
    while not length.endswith(b':'):
        part = client.recv(1)
        if not part: raise RuntimeError('Marionette disconnected')
        length += part
    data = b''
    while len(data) < int(length[:-1]):
        data += client.recv(int(length[:-1]) - len(data))
    return json.loads(data)

def command(name, args=None):
    global seq
    seq += 1
    data = json.dumps([0, seq, name, args or {}]).encode()
    client.sendall(str(len(data)).encode() + b':' + data)
    result = receive()
    if result[2]: raise RuntimeError(json.dumps(result[2], ensure_ascii=False))
    return result[3]

def execute(script, async_=False):
    return command('WebDriver:ExecuteAsyncScript' if async_ else 'WebDriver:ExecuteScript', {'script': script, 'args': [], 'newSandbox': False, 'sandbox': 'default', 'line': 1, 'filename': 'mtprev-firefox-ui'})['value']

def inspect():
    return execute("""return {shell: !!document.getElementById('cdsp-general-shell'), panel: !!document.getElementById('spa-cdsp-panel'), status: document.querySelector('.cdsp-general-shell__status')?.textContent, caption: document.querySelector('.mtprev-orbit__context')?.textContent, options: [...document.querySelectorAll('.mtprev-context-nav > button')].map(b=>b.textContent), ring: [...document.querySelectorAll('.mtprev-orbit__item')].map(b=>b.textContent)};""")

def store_assets():
    output = root / 'store/assets'
    output.mkdir(parents=True, exist_ok=True)
    command('WebDriver:SetWindowRect', {'width':1280,'height':920})
    dimensions = execute('return {x:outerWidth-innerWidth,y:outerHeight-innerHeight};')
    command('WebDriver:SetWindowRect', {'width':1280+dimensions['x'],'height':800+dimensions['y']})
    assert execute('return [innerWidth,innerHeight];') == [1280,800]
    execute("document.querySelector('.mtprev-orbit__center').click();")
    time.sleep(1.5)
    execute("const s=document.getElementById('cdsp-general-shell');s.style.left='842px';s.style.top='146px';s.style.right='auto';s.style.bottom='auto';")
    time.sleep(.5)
    screenshot = command('WebDriver:TakeScreenshot', {'full':False,'scroll':False})['value']
    (output / '01-menu-1280x800.png').write_bytes(base64.b64decode(screenshot))
    execute("[...document.querySelectorAll('.mtprev-orbit__item')].find(b=>b.textContent==='Triagem e Protocolo').click();")
    time.sleep(.8)
    execute("[...document.querySelectorAll('.mtprev-orbit__item')].find(b=>b.textContent==='Triagem').click();")
    time.sleep(.5)
    execute("const s=document.getElementById('cdsp-general-shell');s.style.left='842px';s.style.top='110px';")
    screenshot = command('WebDriver:TakeScreenshot', {'full':False,'scroll':False})['value']
    (output / '02-triagem-1280x800.png').write_bytes(base64.b64decode(screenshot))
    command('WebDriver:Navigate', {'url':'http://127.0.0.1:%d/store/promo.html' % server.server_port})
    time.sleep(.4)
    element = command('WebDriver:FindElement', {'using':'css selector','value':'#promo'})['value']
    screenshot = command('WebDriver:TakeScreenshot', {'id':next(iter(element.values())),'scroll':False})['value']
    (output / 'promocional-440x280.png').write_bytes(base64.b64decode(screenshot))
    for file in output.glob('*.png'):
        data = file.read_bytes()
        print('IMAGEM', file.name, int.from_bytes(data[16:20],'big'), int.from_bytes(data[20:24],'big'))

try:
    for i in range(80):
        if proc.poll() is not None: raise RuntimeError((profile / 'firefox.log').read_text()[-2000:])
        try:
            client = socket.create_connection(('127.0.0.1', marionette_port), timeout=1)
            client.settimeout(35)
            break
        except ConnectionRefusedError: time.sleep(.25)
    if client is None: raise RuntimeError('Firefox did not start')
    receive()
    session = command('WebDriver:NewSession', {'capabilities': {}})
    print('FIREFOX', session.get('capabilities', {}).get('browserVersion'))
    print('ADDON', command('Addon:Install', {'path': str(extension), 'temporary': True}))
    command('WebDriver:Navigate', {'url': url})
    time.sleep(.5)
    print('INITIAL', inspect())
    if args.store_assets:
        store_assets()
        raise SystemExit(0)
    viewport = execute("return {width:innerWidth,height:innerHeight};")
    for corner, x, y in [('superior esquerdo',0,0),('superior direito',viewport['width']-1,0),('inferior esquerdo',0,viewport['height']-1),('inferior direito',viewport['width']-1,viewport['height']-1)]:
        before = execute("const r=document.querySelector('.mtprev-orbit__center').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};")
        command('WebDriver:PerformActions', {'actions': [{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[
            {'type':'pointerMove','duration':0,'origin':'viewport','x':round(before['x']),'y':round(before['y'])},
            {'type':'pointerDown','button':0},
            {'type':'pointerMove','duration':200,'origin':'viewport','x':x,'y':y},
            {'type':'pointerUp','button':0}
        ]}]})
        command('WebDriver:ReleaseActions')
        after = execute("const c=document.querySelector('.mtprev-orbit__center');const r=c.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,expanded:c.getAttribute('aria-expanded'),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};")
        assert after['expanded'] == 'false', after
        assert abs((after['left'] if x == 0 else viewport['width']-after['right'])-8) < 1, after
        assert abs((after['top'] if y == 0 else viewport['height']-after['bottom'])-8) < 1, after
        assert after['scrollWidth'] == after['clientWidth'], after
        print('PASS arraste recolhido:', corner)
    saved_position = execute("return JSON.parse(localStorage.getItem('CDSP_GENERAL_SHELL_POSITION'));")
    command('WebDriver:Refresh')
    time.sleep(.5)
    restored = execute("const r=document.getElementById('cdsp-general-shell').getBoundingClientRect();return {left:r.left,top:r.top};")
    assert abs(restored['left']-saved_position['left']) < 1 and abs(restored['top']-saved_position['top']) < 1, (restored,saved_position)
    print('PASS posicao recolhida restaurada junto a borda')
    execute("document.querySelector('.mtprev-orbit__center').click();")
    time.sleep(.5)
    print('OPEN', inspect())
    bounds = execute("const r=document.getElementById('cdsp-general-shell').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};")
    assert bounds['left'] >= 0 and bounds['top'] >= 0 and bounds['right'] <= viewport['width'] and bounds['bottom'] <= viewport['height'], bounds
    print('PASS menu expandido cabe na janela apos arraste ate a borda')
    execute("[...document.querySelectorAll('.mtprev-orbit__item')].find(b => b.textContent === 'Triagem e Protocolo').click();")
    time.sleep(2)
    triage = inspect()
    print('TRIAGE', triage)
    assert triage['options'] == ['Triagem', 'Duplicados', 'Peças', 'Filtros', 'Programada', 'Registro'], triage
    for label, tab in [('Triagem','triagem'),('Duplicados','duplicados'),('Peças','pecas'),('Filtros','filtros'),('Programada','programada'),('Registro','registro')]:
        execute("[...document.querySelectorAll('.mtprev-orbit__item')].find(b => b.textContent === LABEL).click();".replace('LABEL',json.dumps(label)))
        execute("document.querySelectorAll('.mtprev-context-pages details').forEach(d=>d.open=true);")
        state = execute("""return {active: document.querySelector('.mtprev-context-pages').dataset.activeTab, panelVisible: document.getElementById('spa-cdsp-panel').checkVisibility(), buttons: [...document.querySelectorAll('#spa-cdsp-panel button')].filter(b=>b.checkVisibility()).map(b=>b.textContent), backVisible: document.querySelector('.mtprev-orbit__back').checkVisibility()};""")
        print('PASS submenu:', label)
        assert state['active'] == tab and state['panelVisible'] and state['backVisible'], state
        if tab == 'triagem': assert 'Dar Ciência' in state['buttons'] and 'Abrir Abas' in state['buttons']
        execute("document.querySelector('.mtprev-orbit__back').click();")
        time.sleep(.1)
    team = execute("const done = arguments[arguments.length-1]; window.wrappedJSObject.SPA_CDSP_TEAM_DATABASE.loadActiveNames().then(names => done({count:names.length}), error => done({error:String(error)}));", True)
    print('TEAM_DATABASE', team)
    assert team.get('count',0) > 0, team
    execute("[...document.querySelectorAll('.mtprev-orbit__item')].find(b => b.textContent === 'Duplicados').click();")
    execute("[...document.querySelectorAll('.mtprev-duplicates-page button')].find(b=>b.textContent==='Relatorio Duplicados').click();")
    for _ in range(200):
        report = execute("return {ready:!!document.getElementById('spa-cdsp-duplicate-report-overlay'), progress:document.querySelector('.mtprev-duplicates-loading')?.textContent, busy:document.querySelector('.mtprev-duplicates-page').getAttribute('aria-busy')};")
        if report['busy'] == 'false': break
        time.sleep(.1)
    assert report['ready'], report
    data = execute("return {clicks:JSON.parse(JSON.stringify(window.wrappedJSObject.fixture.clicks)), groups:[...document.querySelectorAll('#spa-cdsp-duplicate-report-overlay details > summary')].map(s=>s.textContent)};")
    assert data['clicks'] == {'lazy':1,'hidden':1,'single':1,'next-page':1,'ses':1}, data
    assert len(data['groups']) == 2, data
    assert any('0000001-00.2026.8.11.0001' in g and '3 pendencia(s)' in g for g in data['groups']), data
    assert any('0000002-00.2026.8.11.0001' in g and '2 pendencia(s)' in g for g in data['groups']), data
    print('PASS relatório: todos os grupos acionados, itens atrasados, duas páginas, exclusão SES e agregação por processo')
    for module, panel_id in [('prazos','spa-cdsp-deadline-panel'),('gestao','spa-cdsp-management-panel'),('oficios','cdsp-general-module-oficios')]:
        execute("document.querySelector('[data-cdsp-module-button=MODULE]').click();".replace('MODULE',module))
        for _ in range(100):
            if execute("return !!document.getElementById(PANEL);".replace('PANEL',json.dumps(panel_id))): break
            time.sleep(.1)
        assert execute("return !!document.getElementById(PANEL);".replace('PANEL',json.dumps(panel_id))), module
    execute("document.querySelector('[data-cdsp-module-button=triagem]').click();")
    # Verifica contraste real computado, inclusive botões do modal fora do shell.
    execute("document.querySelectorAll('#spa-cdsp-duplicate-report-overlay details').forEach(d=>d.open=true);")
    contrast_script = r"""
      const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
      const luminance = color => rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const buttons = [...document.querySelectorAll('#cdsp-general-shell button,#spa-cdsp-duplicate-report-overlay button')].filter(b=>!b.classList.contains('mtprev-orbit__item') && b.textContent.trim());
      const failures = buttons.flatMap(button=>{
        const s=getComputedStyle(button), l1=luminance(s.color), l2=luminance(s.backgroundColor);
        const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        return ratio<4.5?[{text:button.textContent,ratio,color:s.color,bg:s.backgroundColor}]:[];
      });
      return {count:buttons.length,failures,scheme:getComputedStyle(document.documentElement).getPropertyValue('--mtprev-color-scheme').trim(),native:getComputedStyle(document.getElementById('native-button')).backgroundColor};
    """
    for theme in ['light','dark']:
        execute("document.getElementById('cdsp-general-shell').dataset.mtTheme=THEME;".replace('THEME',json.dumps(theme)))
        time.sleep(.2)
        colors = execute(contrast_script)
        assert colors['count'] > 60 and not colors['failures'], colors
        assert colors['scheme'] == theme and colors['native'] == 'rgb(120, 0, 120)', colors
        print('PASS contraste >= 4.5:1 dos botões, tema',theme, 'total:',colors['count'])
    execute("document.getElementById('cdsp-general-shell').removeAttribute('data-mt-theme');document.documentElement.classList.add('cdsp-spa-dark-mode');")
    assert execute(contrast_script)['scheme'] == 'dark'
    print('PASS tema escuro da página aplicado também aos botões do relatório')
    execute("document.getElementById('spa-cdsp-duplicate-report-overlay').remove();window.wrappedJSObject.fixture.fail=true;[...document.querySelectorAll('.mtprev-duplicates-page button')].find(b=>b.textContent==='Relatorio Duplicados').click();")
    time.sleep(.2)
    failure = execute("const n=document.querySelector('.mtprev-duplicates-page .mtprev-duplicates-loading');return {text:n.textContent,visible:n.checkVisibility(),role:n.getAttribute('role'),busy:document.querySelector('.mtprev-duplicates-page').getAttribute('aria-busy'),retry:!document.querySelector('.mtprev-duplicates-page button').disabled};")
    assert failure['visible'] and failure['role'] == 'alert' and failure['busy'] == 'false' and failure['retry'] and 'Falha simulada' in failure['text'], failure
    print('PASS falha aparece no painel de duplicados e permite tentar novamente')
    execute("window.wrappedJSObject.fixture.fail=false;window.wrappedJSObject.fixture.hang=true;window.wrappedJSObject.dtProceduresBox.page(0).draw();[...document.querySelectorAll('.mtprev-duplicates-page button')].find(b=>b.textContent==='Relatorio Duplicados').click();")
    for _ in range(230):
        stalled = execute("const p=document.querySelector('.mtprev-duplicates-page');return {busy:p.getAttribute('aria-busy'),text:p.querySelector('.mtprev-duplicates-loading').textContent,ready:!!document.getElementById('spa-cdsp-duplicate-report-overlay')};")
        if stalled['busy'] == 'false': break
        time.sleep(.1)
    assert stalled['busy'] == 'false' and not stalled['ready'] and 'não terminaram de carregar' in stalled['text'], stalled
    print('PASS grupo que não responde encerra a espera com erro, sem exibir relatório vazio')
    command('WebDriver:Refresh')
    for _ in range(40):
        reloaded = inspect()
        if reloaded['panel'] and len(reloaded['options']) == 6: break
        time.sleep(.1)
    assert reloaded['panel'] and len(reloaded['options']) == 6, reloaded
    print('PASS Triagem restaura ao recarregar a pagina')
    command('Marionette:SetContext', {'value': 'chrome'})
    errors = execute("return Services.console.getMessageArray().filter(m => /moz-extension:|chrome-extension:|Unable to load script/.test(m.message) && /Error|Exception|Unable to load script/i.test(m.message)).map(m => m.message);")
    assert not errors, errors
    print('PASS sem erros de carregamento dos scripts ou icones')
    options_url = execute("return WebExtensionPolicy.getByID('mtprev-extensao@mtprev.local').getURL('options.html');")
    command('Marionette:SetContext', {'value': 'content'})
    command('WebDriver:Navigate', {'url':options_url})
    time.sleep(.3)
    assert execute("return document.getElementById('status').textContent;") == 'Serviço de andamentos desativado.'
    execute("document.getElementById('endpoint').value='https://example.org/';document.getElementById('consent').checked=true;document.getElementById('service-form').requestSubmit();")
    assert execute("return document.getElementById('status').dataset.error;") == 'true'
    execute("document.getElementById('endpoint').value='https://pje-mcp-worker-tjmt.joaooliveira.workers.dev/demo-only';document.getElementById('service-form').requestSubmit();")
    time.sleep(.2)
    command('WebDriver:Refresh')
    time.sleep(.3)
    assert execute("return document.getElementById('consent').checked;")
    execute("document.getElementById('disable-service').click();")
    time.sleep(.2)
    command('WebDriver:Refresh')
    time.sleep(.3)
    assert execute("return [document.getElementById('endpoint').value,document.getElementById('consent').checked];") == ['',False]
    print('PASS opções: serviço desativado por padrão, domínio validado, consentimento salvo e configuração apagada')
finally:
    if client: client.close()
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
    server.shutdown()
    log.close()
    server.server_close()
    shutil.rmtree(profile)
