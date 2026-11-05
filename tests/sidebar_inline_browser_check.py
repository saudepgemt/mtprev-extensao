"""Browser smoke test for self-contained SPA workspace filter fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
js=(root/'js/radial_menu.js').read_text().replace("if (!/^\\/workspace\\/?$/.test(location.pathname) || window.__mtprevWorkspaceFilterSidebar) return;", "if (window.__mtprevWorkspaceFilterSidebar) return;")
js=js.replace("if (!/^\/workspace\/?$/.test(location.pathname) || window.__mtprevWorkspaceFilterSidebar) return;", "if (window.__mtprevWorkspaceFilterSidebar) return;")
js=js.replace("const isWorkspace = () => /^\/workspace\/?$/.test(location.pathname);", "const isWorkspace = () => true;")
css=(root/'css/radial_menu.css').read_text()
opts=lambda items,kind: ''.join(f'<a class="workspace-deadline-type-filter__option {kind}" href="/workspace?f={i}" aria-selected="false">{i}</a>' for i in items)
markers=''.join(f'<a href="/workspace?marker={i}" class="workspace-marker-filter__option"><span class="workspace-marker-filter__name">Marcador {i}</span></a>' for i in range(30))
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
body {{ margin:0;background:#edf3f8;font:13px sans-serif; }}
.workspace-layout {{display:grid;grid-template-columns:240px 1fr;gap:15px;margin:80px 14px 0;align-items:start;}}
.workspace-navigation {{height:auto;padding:0 4px;}}
.workspace-main {{min-height:2400px;}}
.workspace-processes__toolbar {{height:75px;background:#234c60;color:white;}}
.workspace-panel {{border-radius:8px;background:#eaf1f8;}}
.workspace-panel__heading {{padding:8px;background:#21465a;color:white;}}
.workspace-deadline-type-filter__panel,.workspace-marker-filter__panel,.workspace-organizer__panel {{position:absolute;right:0;min-width:420px;background:white;box-shadow:0 3px 15px #aaa;}}
.workspace-organizer__options {{display:flex;flex-direction:row;gap:4px;}}
.workspace-organizer__row {{display:flex;}}
.workspace-marker-filter__options {{display:grid;grid-template-columns:repeat(4,1fr);}}
</style></head><body class="mtprev-workspace-readable mtprev-workspace-filter-dock">
<div class="workspace-inbox"><div class="workspace-hero">
<div id="workspace-process-type-filter"><details><summary>Tipos de processo</summary><div class="workspace-deadline-type-filter__panel"><div class="workspace-deadline-type-filter__header">Tipos de processo <a class="workspace-deadline-type-filter__default" href="/workspace">Restaurar</a></div><div class="workspace-deadline-type-filter__options">{opts(['Todos','Judicial','Administrativo','Tarefa'], 'workspace-process-type-filter-link')}</div></div></details></div>
<div id="workspace-deadline-type-filter"><details><summary>Tipos de prazo</summary><div class="workspace-deadline-type-filter__panel"><div class="workspace-deadline-type-filter__header">Tipos de prazo <a class="workspace-deadline-type-filter__default" href="/workspace">Restaurar</a></div><div class="workspace-deadline-type-filter__options">{opts(['Todos','Manifestação','Audiência','Ciência tácita'], 'workspace-deadline-type-filter-link')}</div></div></details></div>
</div>
<div class="workspace-layout"><aside class="workspace-navigation" id="workspace-navigation"><section class="workspace-panel"><div class="workspace-panel__heading">Visões rápidas</div><div>Todos</div></section></aside><main class="workspace-main">
<div class="workspace-processes__toolbar">Processos</div>
<div id="workspace-marker-filter"><details><summary>Marcadores</summary><div class="workspace-marker-filter__panel"><div class="workspace-marker-filter__header"><label class="workspace-marker-filter__search"><input type="search" placeholder="Buscar marcador"></label></div><div class="workspace-marker-filter__options">{markers}</div></div></details></div>
<div id="workspace-process-organizer"><details><summary>Organizar</summary><div class="workspace-organizer__panel"><div class="workspace-organizer__row"><span class="workspace-organizer__label">Ordenar por</span><div class="workspace-organizer__options"><a href="/workspace?sort=deadline" class="workspace-organizer__chip">Prazo</a><a href="/workspace?sort=status" class="workspace-organizer__chip">Status</a></div><div class="workspace-organizer__direction"><a href="/workspace?direction=asc" class="workspace-organizer__direction-option">Crescente</a><a href="/workspace?direction=desc" class="workspace-organizer__direction-option">Decrescente</a></div></div></div></details></div>
<div class="workspace-processes__heading">Processos para trabalhar</div><div id="workspace-process-results" style="height:1200px"></div>
</main></div></div></body></html>'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1366,'height':768},device_scale_factor=1)
 page.set_content(html)
 page.add_style_tag(content=css)
 page.add_script_tag(content=js)
 page.wait_for_timeout(600)
 d=page.evaluate('''() => {
  const nav=document.querySelector('.workspace-navigation');
  const panels=[...document.querySelectorAll('.mtprev-workspace-filter-panel')];
  return {panelKeys:panels.map(x=>x.dataset.mtprevFilter), opened:[...nav.querySelectorAll('details')].map(x=>x.open), navClientHeight:nav.clientHeight, navScrollHeight:nav.scrollHeight, navOverflow:getComputedStyle(nav).overflowY,
    panelWidth:nav.querySelector('.workspace-marker-filter__panel').getBoundingClientRect().width,
    navWidth:nav.getBoundingClientRect().width, 
    organizeFlex:getComputedStyle(nav.querySelector('.workspace-organizer__options')).flexDirection,
    processTextColor:getComputedStyle(nav.querySelector('.workspace-deadline-type-filter__option')).color,
    links:nav.querySelectorAll('a').length,
    nativeIds:[...nav.querySelectorAll('[id^="workspace-"]')].map(x=>x.id)
  }
 }''')
 print('Browser result:',d)
 assert all(x in d['panelKeys'] for x in ['process','deadline','markers','organize']), d
 assert all(d['opened']),d
 assert d['navScrollHeight']>d['navClientHeight'],d
 assert d['navOverflow']=='auto',d
 assert d['panelWidth']<=d['navWidth'],d
 assert d['organizeFlex']=='column',d
 page.mouse.move(120,320)
 page.mouse.wheel(0,580)
 page.wait_for_timeout(180)
 positions=page.evaluate('''() => ({sidebar:document.querySelector('.workspace-navigation').scrollTop, page:document.scrollingElement.scrollTop})''')
 print('Wheel scroll:',positions)
 assert positions['sidebar']>0, positions
 assert positions['page']<20, positions
 page.mouse.wheel(0,-1500)
 page.wait_for_timeout(150)
 page.screenshot(path='/mnt/data/mtprev_workspace_sidebar_v2_preview.png')
 b.close()
print('BROWSER SMOKE PASS')
