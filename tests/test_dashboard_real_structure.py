from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).parent
with sync_playwright() as play:
 browser=play.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1300,'height':1000})
 page.set_content((p/'preview_real_dom_fixture.html').read_text())
 page.add_script_tag(path=str(p.parent/'js/iframe_autos_bridge.js'))
 page.wait_for_timeout(650)
 data=page.evaluate('''() => ({
  slots:Object.fromEntries(['prazos','ultimos','relacionados','situacao','dados','eventos'].map(k=>[k,document.querySelector('.mtprev-cell-'+k+' > *')?.id])),
  visible:document.querySelector('#workspace-preview-overview').getBoundingClientRect().height>0,
  expedientes:document.querySelector('[data-workspace-relationship-tab="pending_notice"]').getAttribute('aria-expanded'),
  loaded:document.querySelector('[data-workspace-relationship-content]').textContent,
  cards:Array.from(document.querySelectorAll('#workspace-preview-overview .mtprev-card-header strong')).map(n=>n.textContent),
  recent:Array.from(document.querySelectorAll('.mtprev-recent-item strong')).map(n=>n.textContent),
  cols:getComputedStyle(document.querySelector('.mtprev-overview-layout')).gridTemplateColumns,
  leftover:document.querySelector('.workspace-preview__overview-grid').getBoundingClientRect().height,
  usersTab:!!document.querySelector('.mtprev-users-tab')
 })''')
 print(data)
 assert data['slots']=={'prazos':'section-prazos','ultimos':'mtprev-recent-movements','relacionados':'section-relacionados','situacao':'section-situacao','dados':'section-dados','eventos':'section-eventos'}
 assert data['usersTab']
 assert data['expedientes']=='true' and data['loaded']=='7 expedientes carregados'
 assert data['recent']==['Primeiro andamento','Segundo andamento','Terceiro andamento']
 assert data['leftover']==0, 'native grid must be empty/hidden'
 page.screenshot(path='/mnt/data/mtprev_dashboard_fixed_preview.png',full_page=True)
 page.locator('[data-workspace-preview-tab="timeline"]').click()
 page.wait_for_timeout(300)
 assert not page.locator('#workspace-preview-overview').is_visible(), 'overview leaks into timeline'
 assert page.locator('#workspace-preview-timeline').is_visible(), 'native timeline must remain'
 assert page.locator('#workspace-preview-timeline .workspace-preview__timeline-item').count()==4
 page.locator('[data-workspace-preview-tab="annotations"]').click()
 assert not page.locator('#workspace-preview-overview').is_visible(), 'overview leaks into annotations'
 page.locator('[data-workspace-preview-tab="overview"]').click()
 page.wait_for_timeout(300)
 assert page.locator('#workspace-preview-overview').is_visible()
 page.locator('.mtprev-users-tab').click()
 assert page.locator('#mtprev-workspace-users').is_visible()
 assert not page.locator('#workspace-preview-overview').is_visible()
 assert page.locator('#mesa-original').inner_text()=='MESA INTACTA'
 print('BROWSER_REAL_STRUCTURE_PASS')
 browser.close()
