import { chromium } from 'playwright';

// Start the development server first; this route uses no live research data.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const [width, height] of [[1280, 720], [1024, 768], [390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${process.env.ARCHITECTURE_BASE_URL ?? 'http://127.0.0.1:8107'}/architecture`);
    await page.getByRole('heading', { name: 'PRAGMA · 통합 워크플로우' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('section')].filter(s => s.querySelector('h2'));
      const cycle = document.querySelector('[aria-label="평가와 개선 결과를 다음 콘텐츠, 미션, 수업 설계에 반영"]');
      return {
        cardCount: cards.length,
        overflow: cards.map(s => s.scrollHeight - s.clientHeight),
        escapedChildren: cards.flatMap(s => [...s.children].filter(c => c.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom + 1).map(c => c.textContent)),
        cycleGap: cycle.getBoundingClientRect().top - Math.max(...cards.map(s => s.getBoundingClientRect().bottom)),
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        documentOverflow: document.documentElement.scrollHeight - innerHeight,
      };
    });
    console.log(JSON.stringify({ width, height, ...layout }));
    if (layout.cardCount !== 3 || layout.overflow.some(n => n > 1) || layout.escapedChildren.length || layout.cycleGap < 0 || layout.horizontalOverflow > 0) {
      throw new Error('Architecture layout overflow');
    }
    if (width === 1440) {
      if (layout.documentOverflow > 0) throw new Error('Capture viewport clips the diagram');
      await page.screenshot({ path: 'docs/screenshots/02-architecture.png', fullPage: false });
    }
  }
} finally {
  await browser.close();
}
