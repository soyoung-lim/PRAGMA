import { test, expect } from '@playwright/test';

test('Scenario verification workflow', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 1. Open /student-login
  await page.goto('http://localhost:8080/student-login');
  await page.screenshot({ path: '/tmp/browser/scenario/screenshots/1_login_page.png' });

  // 2. Click the stub login button
  await page.getByRole('button', { name: '[DEV] 임시 학습자로 로그인 (stub)' }).click();

  // 3. Wait until profile setup or home
  await page.waitForTimeout(2000); // Give it a moment to redirect

  if (page.url().includes('profile-setup') || (await page.getByText('프로필 설정').isVisible())) {
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/2_profile_setup_start.png' });

    // Step 1
    await page.getByPlaceholder('실명을 입력해 주세요').fill('테스트');
    await page.getByText('학부생', { exact: true }).click();
    await page.getByRole('button', { name: '다음' }).click();

    // Step 2
    await page.getByText('HSK 4급').click();
    await page.getByText('수업 위주').click();
    await page.getByText('1년 미만').click();
    await page.getByRole('button', { name: '다음' }).click();

    // Step 3
    await page.getByText('연구 목적').click();
    await page.getByText('익명 식별자').click();
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/3_profile_setup_consents.png' });
    await page.getByRole('button', { name: '학습 시작하기' }).click();
  }

  // 4. Wait for navigation to /home
  await page.waitForURL('**/home', { timeout: 10000 });
  await page.screenshot({ path: '/tmp/browser/scenario/screenshots/4_home.png' });

  // 5. Navigate to /scenario
  await page.goto('http://localhost:8080/scenario');
  await page.waitForSelector('text=발화 상황 판단', { timeout: 10000 });
  await page.screenshot({ path: '/tmp/browser/scenario/screenshots/5_scenario_list.png' });

  // 6. Verify Filter Buttons are GONE
  // The user says "요청 상황" or "거절 상황" buttons should NOT appear.
  const requestBtn = page.getByRole('button', { name: '요청 상황' });
  const refusalBtn = page.getByRole('button', { name: '거절 상황' });
  
  // We should check if they are hidden or not present
  const isRequestBtnVisible = await requestBtn.isVisible();
  const isRefusalBtnVisible = await refusalBtn.isVisible();
  
  // 7. Verify "전체 상황" label
  const totalLabel = page.getByText('전체 상황');
  const isTotalLabelVisible = await totalLabel.isVisible();

  // 8. Verify Approved Scenario Cards (at least 2)
  // According to ScenarioSelect.tsx, cards are buttons with specific classes
  const cards = page.locator('button.flex.flex-col.gap-2');
  const count = await cards.count();
  
  // 9. Click one scenario card
  if (count > 0) {
    await cards.first().click();
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/6_scenario_selected.png' });

    // 10. Verify "번역안 비교하기" button state
    // Note: The button text in code is "번역안 비교하기 →"
    const proceedBtn = page.getByRole('button', { name: /번역안 비교하기/ });
    const isDisabledInitially = await proceedBtn.isDisabled();

    // 11. Answer the three questions
    const fieldsets = page.locator('fieldset');
    const qCount = await fieldsets.count();
    for (let i = 0; i < qCount; i++) {
      await fieldsets.nth(i).locator('label').first().click();
    }
    await page.screenshot({ path: '/tmp/browser/scenario/screenshots/7_questions_answered.png' });

    // 12. Button should now be enabled
    const isEnabledAfter = await proceedBtn.isEnabled();

    // 13. Source playback
    const ttsBtn = page.getByLabel('원문 듣기').first();
    if (await ttsBtn.isVisible()) {
      await ttsBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log('REPORT_START');
    console.log('URL: ' + page.url());
    console.log('Filter buttons gone: ' + (!isRequestBtnVisible && !isRefusalBtnVisible));
    console.log('Scenario count: ' + count);
    console.log('Selection + Progression works: ' + isEnabledAfter);
    console.log('Console errors: ' + (consoleErrors.length > 0 ? consoleErrors.join(', ') : 'None'));
    console.log('Screenshot paths: /tmp/browser/scenario/screenshots/');
    console.log('REPORT_END');
  } else {
    console.log('REPORT_START');
    console.log('ERROR: No scenarios found');
    console.log('REPORT_END');
  }
});
