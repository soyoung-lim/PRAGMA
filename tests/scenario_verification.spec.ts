import { test, expect, chromium } from '@playwright/test';

test('Scenario verification workflow', async () => {
  const browser = await chromium.launch({
    executablePath: '/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.route('**/rest/v1/scenarios*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          scenario_id: 'test-1',
          title: '비즈니스 협력 요청',
          speech_act: 'request',
          speech_act_text: '협력 요청',
          industry_sector: 'IT',
          domain: '소프트웨어',
          source_text: '저희와 새로운 프로젝트를 함께 진행해 주실 수 있을까요?',
          week_no: 1,
          language_direction: 'ko_to_zh',
          scenario_p: '상대방이 높음',
          scenario_d: '보통',
          scenario_r: '높음',
          pragmatic_challenge: ['체면 유지', '격식'],
          challenge_intensity: '중',
          hsk_level_min: 5,
          review_status: 'approved',
          created_at: new Date().toISOString()
        },
        {
          scenario_id: 'test-2',
          title: '제안 거절',
          speech_act: 'refusal',
          speech_act_text: '거절',
          industry_sector: '유통',
          domain: '물류',
          source_text: '죄송하지만 현재로서는 해당 제안을 수락하기 어렵습니다.',
          week_no: 2,
          language_direction: 'ko_to_zh',
          scenario_p: '동등',
          scenario_d: '가까움',
          scenario_r: '낮음',
          pragmatic_challenge: ['완곡한 표현'],
          challenge_intensity: '하',
          hsk_level_min: 4,
          review_status: 'approved',
          created_at: new Date().toISOString()
        }
      ])
    });
  });

  try {
    await page.goto('http://localhost:8080/student-login');
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/1_login.png' });
    await page.getByRole('button', { name: '[DEV] 임시 학습자로 로그인 (stub)' }).click();
    
    // Handle profile setup if visible
    await page.waitForTimeout(2000);
    if (page.url().includes('profile-setup') || await page.getByText('프로필 설정').isVisible()) {
      await page.getByPlaceholder('실명을 입력해 주세요').fill('테스트');
      await page.getByText('학부생', { exact: true }).click();
      await page.getByRole('button', { name: '다음' }).click();
      await page.getByText('HSK 4급').click();
      await page.getByText('수업 위주').click();
      await page.getByText('1년 미만').click();
      await page.getByRole('button', { name: '다음' }).click();
      await page.getByText('연구 목적').click();
      await page.getByText('익명 식별자').click();
      await page.screenshot({ path: '/tmp/browser/scenario/screenshots/2_profile.png' });
      await page.getByRole('button', { name: '학습 시작하기' }).click();
    }

    await page.waitForURL('**/home');
    await page.goto('http://localhost:8080/scenario');
    await page.waitForSelector('text=비즈니스 협력 요청', { timeout: 10000 });
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/3_list.png' });

    const requestBtn = page.getByRole('button', { name: '요청 상황' });
    const refusalBtn = page.getByRole('button', { name: '거절 상황' });
    const totalLabel = page.getByText('전체 상황');
    
    const cards = page.locator('button:has-text("비즈니스 협력 요청"), button:has-text("제안 거절")');
    const count = await cards.count();
    
    await cards.first().click();
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/4_selected.png' });

    const proceedBtn = page.getByRole('button', { name: /번역안 비교하기/ });
    const fieldsets = page.locator('fieldset');
    for (let i = 0; i < 3; i++) {
      await fieldsets.nth(i).locator('label').first().click();
    }
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/5_answered.png' });

    console.log('REPORT_START');
    console.log('URL: ' + page.url());
    console.log('Filter buttons gone: ' + (!(await requestBtn.isVisible()) && !(await refusalBtn.isVisible())));
    console.log('Scenario count: ' + count);
    console.log('Selection + Progression works: ' + (await proceedBtn.isEnabled()));
    console.log('Console errors: ' + (consoleErrors.length > 0 ? consoleErrors.join(', ') : 'None'));
    console.log('Screenshot paths: /tmp/browser/scenario/screenshots/');
    console.log('REPORT_END');

  } finally {
    await browser.close();
  }
});
