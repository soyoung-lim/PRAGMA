import { useNavigate } from "react-router-dom";

/**
 * WorkflowPreview — 정적 예시 페이지.
 * 첨부 workflow_preview_complaint_mid.html 을 그대로 이식.
 * 어떤 DB/Edge 호출도 없음. 실제 학습 5단계와 완전 분리.
 */
const WorkflowPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="wfp-root">
      <style>{`
        .wfp-root{
          --dark:#15202B; --ink:#1F2430; --muted:#5B6270; --faint:#98A0AC;
          --bg:#FFFFFF; --panel:#FAF9F6; --card:#FFFFFF;
          --line:#E7E5DF; --line-2:#F0EFEA;
          --accent:#FAD338; --accent-soft:#FDF3CF; --accent-deep:#8A6A1F;
          --ok:#3F8F5B; --ok-soft:#E9F4ED;
          --warn:#B5852A; --warn-soft:#FBF1DA;
          --bad:#C0492E; --bad-soft:#FBEBE7;
          --zh:#7A3E12;
          background:var(--bg); color:var(--ink);
          font-family:'Noto Sans KR', system-ui, -apple-system, sans-serif;
          line-height:1.6; min-height:100vh;
        }
        .wfp-root *{box-sizing:border-box;}
        .wfp-root .topbar{background:var(--dark);color:#fff;padding:15px 30px;display:flex;align-items:center;gap:10px;}
        .wfp-root .topbar .yb{width:5px;height:20px;background:var(--accent);border-radius:2px;}
        .wfp-root .topbar .tt{font-size:15px;font-weight:700;}
        .wfp-root .topbar .back{margin-left:auto;font-size:13px;color:#B9BEC7;background:none;border:none;cursor:pointer;}
        .wfp-root .wrap{max-width:900px;margin:0 auto;padding:26px 24px 60px;}
        .wfp-root .pagehead{border-left:4px solid var(--accent);padding-left:14px;margin-bottom:8px;}
        .wfp-root .pagehead h1{font-size:24px;font-weight:700;}
        .wfp-root .pagesub{color:var(--muted);font-size:13.5px;margin:6px 0 4px 18px;}
        .wfp-root .previewbadge{display:inline-flex;align-items:center;gap:6px;margin:10px 0 0 18px;background:var(--warn-soft);color:var(--warn);font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;}
        .wfp-root .metabar{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 8px;}
        .wfp-root .chip{font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--line);background:var(--panel);color:var(--muted);}
        .wfp-root .chip b{color:var(--ink);font-weight:700;}
        .wfp-root .chip.hl{background:var(--accent-soft);border-color:#E8D488;color:var(--accent-deep);}
        .wfp-root .steps{display:flex;gap:6px;margin:22px 0 26px;}
        .wfp-root .stepitem{flex:1;text-align:center;padding:9px 6px;border-radius:9px;background:var(--panel);border:1px solid var(--line);font-size:12px;color:var(--muted);position:relative;}
        .wfp-root .stepitem b{display:block;font-size:12.5px;color:var(--ink);font-weight:700;}
        .wfp-root .stepitem .n{display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:var(--dark);color:#fff;font-size:11px;font-weight:700;margin-bottom:5px;}
        .wfp-root .stage{margin:0 0 20px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;}
        .wfp-root .stagehead{padding:13px 18px;background:var(--panel);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:11px;}
        .wfp-root .stagehead .sn{width:26px;height:26px;border-radius:50%;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 26px;}
        .wfp-root .stagehead h2{font-size:15.5px;font-weight:700;}
        .wfp-root .stagehead .tag{margin-left:auto;font-size:11px;color:var(--faint);}
        .wfp-root .stagebody{padding:16px 18px;}
        .wfp-root .lead{font-size:13px;color:var(--muted);margin-bottom:12px;}
        .wfp-root .lead b{color:var(--ink);}
        .wfp-root .mini{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .wfp-root .minicard{background:var(--accent-soft);border:1px solid #EBD98C;border-radius:10px;padding:12px 14px;}
        .wfp-root .minicard .mt{font-size:12px;font-weight:700;color:var(--accent-deep);margin-bottom:4px;}
        .wfp-root .minicard .md{font-size:12.5px;color:#5c4a1a;line-height:1.5;}
        .wfp-root .zh{color:var(--zh);font-weight:700;}
        .wfp-root .situ{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px;}
        .wfp-root .situ .role{font-size:11.5px;color:var(--faint);margin-bottom:3px;}
        .wfp-root .situ .utt{font-size:13.5px;color:var(--ink);line-height:1.6;}
        .wfp-root .situ .utt.zh{color:var(--zh);}
        .wfp-root .arrowdown{text-align:center;color:var(--faint);font-size:16px;margin:2px 0;}
        .wfp-root .src{background:#fff;border:1px dashed var(--line);border-radius:10px;padding:13px 16px;}
        .wfp-root .src .lbl{font-size:11px;font-weight:700;color:var(--accent-deep);letter-spacing:.02em;margin-bottom:4px;}
        .wfp-root .src .ko{font-size:14px;color:var(--ink);font-weight:500;line-height:1.6;}
        .wfp-root .cands{display:flex;flex-direction:column;gap:9px;}
        .wfp-root .cand{border:1px solid var(--line);border-radius:10px;padding:11px 14px;display:flex;gap:12px;align-items:flex-start;background:#fff;}
        .wfp-root .cand .dlv{flex:0 0 58px;font-size:10.5px;color:var(--faint);text-align:center;}
        .wfp-root .cand .dlv .num{display:block;font-size:15px;font-weight:700;color:var(--ink);}
        .wfp-root .cand .body{flex:1;}
        .wfp-root .cand .zh{font-size:13.5px;color:var(--zh);font-weight:700;line-height:1.5;}
        .wfp-root .cand .rate{display:flex;gap:5px;margin-top:7px;}
        .wfp-root .rate .rbtn{font-size:11px;border:1px solid var(--line);border-radius:16px;padding:3px 10px;color:var(--muted);background:#fff;}
        .wfp-root .cand.answer{border-color:#BFE0CC;background:var(--ok-soft);}
        .wfp-root .cand.answer .badge{font-size:10.5px;font-weight:700;color:var(--ok);}
        .wfp-root .cand.bad{border-color:#EFC9BE;background:var(--bad-soft);}
        .wfp-root .flabel{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:12px;margin-top:6px;display:inline-block;}
        .wfp-root .flabel.ok{background:#D8EEDF;color:var(--ok);}
        .wfp-root .flabel.bad{background:#F4D6CC;color:var(--bad);}
        .wfp-root .explain{display:flex;flex-direction:column;gap:10px;}
        .wfp-root .exrow{border-left:3px solid var(--accent);background:var(--panel);border-radius:0 8px 8px 0;padding:10px 14px;}
        .wfp-root .exrow .eh{font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:3px;}
        .wfp-root .exrow .ed{font-size:12.5px;color:var(--muted);line-height:1.55;}
        .wfp-root .exrow .ed .el{display:inline-block;font-weight:700;color:var(--zh);background:#fff;border:1px solid var(--line);border-radius:4px;padding:0 5px;margin:0 1px;font-size:12px;}
        .wfp-root .l1{border-left-color:var(--dark);}
        .wfp-root .l1 .eh{color:var(--dark);}
        .wfp-root .produce .task{font-size:13px;color:var(--ink);background:var(--accent-soft);border:1px solid #EBD98C;border-radius:8px;padding:10px 14px;margin-bottom:10px;}
        .wfp-root .produce .task b{color:var(--accent-deep);}
        .wfp-root .inputbox{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff;min-height:74px;color:var(--faint);font-size:13px;}
        .wfp-root .inputbox .typed{color:var(--zh);font-weight:700;}
        .wfp-root .hintline{font-size:11.5px;color:var(--faint);margin-top:7px;}
        .wfp-root .hintline .hbtn{border:1px solid var(--line);border-radius:14px;padding:2px 9px;color:var(--muted);font-size:11px;}
        .wfp-root .model{margin-top:12px;border:1px solid var(--line);border-radius:10px;overflow:hidden;}
        .wfp-root .model .mh{background:var(--panel);padding:8px 14px;font-size:12px;font-weight:700;color:var(--ink);border-bottom:1px solid var(--line);}
        .wfp-root .model .mb{padding:11px 14px;font-size:13.5px;color:var(--zh);font-weight:700;line-height:1.55;}
        .wfp-root .rubric{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:12px;}
        .wfp-root .rcard{border:1px solid var(--line);border-radius:10px;padding:11px 13px;background:#fff;}
        .wfp-root .rcard .rn{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:6px;}
        .wfp-root .rcard .bar{height:7px;border-radius:4px;background:var(--line-2);overflow:hidden;margin-bottom:5px;}
        .wfp-root .rcard .bar span{display:block;height:100%;border-radius:4px;}
        .wfp-root .rcard .rv{font-size:11.5px;color:var(--muted);}
        .wfp-root .weak{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;}
        .wfp-root .weak .wt{font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:6px;}
        .wfp-root .weak ul{margin:0 0 0 2px;padding:0;list-style:none;}
        .wfp-root .weak li{font-size:12.5px;color:var(--muted);padding:3px 0;padding-left:16px;position:relative;}
        .wfp-root .weak li::before{content:"·";position:absolute;left:4px;color:var(--bad);font-weight:700;}
        .wfp-root .nextbtn{margin-top:12px;display:inline-block;background:var(--dark);color:#fff;font-size:13px;font-weight:700;padding:10px 18px;border-radius:9px;}
        .wfp-root .notew{margin-top:8px;font-size:11.5px;color:var(--faint);line-height:1.5;}
        .wfp-root .divider-note{margin:26px 0 8px;padding:12px 16px;background:var(--panel);border:1px dashed var(--line);border-radius:10px;font-size:12px;color:var(--muted);line-height:1.6;}
        .wfp-root .divider-note b{color:var(--ink);}
        .wfp-root .footer{margin-top:26px;border-top:1px solid var(--line-2);padding-top:14px;font-size:11.5px;color:var(--faint);line-height:1.6;}
      `}</style>

      <div className="topbar">
        <span className="yb" />
        <span className="tt">AI 기반 한·중 통번역 학습 워크플로우</span>
        <button className="back" onClick={() => navigate("/roadmap")}>← 15주 학습 설계로</button>
      </div>

      <div className="wrap">
        <div className="pagehead"><h1>학습은 이렇게 진행됩니다</h1></div>
        <div className="pagesub">15주 강의계획의 한 주차가 실제로 어떻게 흘러가는지, 예시 하나로 보여드립니다.</div>
        <div className="previewbadge">● 예시 미리보기 · 실제 학습 화면은 이 흐름으로 구현 예정</div>

        <div className="metabar">
          <span className="chip hl">10주차 · <b>불만 · 불만 대응</b></span>
          <span className="chip">학습자 수준 <b>중급 · HSK 5급</b></span>
          <span className="chip">언어 방향 <b>한국어 → 중국어</b></span>
          <span className="chip">채널 <b>업무 이메일</b> · 모드 번역</span>
          <span className="chip">상황값 P <b>대등</b> · D <b>공적</b> · R <b>중간</b></span>
        </div>

        <div className="steps">
          <div className="stepitem"><span className="n">1</span><b>상황+미니학습</b>먼저 배우기</div>
          <div className="stepitem"><span className="n">2</span><b>적절성 판단</b>후보 평가</div>
          <div className="stepitem"><span className="n">3</span><b>화용 설명</b>이유 확인</div>
          <div className="stepitem"><span className="n">4</span><b>직접 산출</b>내가 번역</div>
          <div className="stepitem"><span className="n">5</span><b>수행 리포트</b>약점·다음</div>
        </div>

        {/* 1 */}
        <div className="stage">
          <div className="stagehead"><span className="sn">1</span><h2>상황 + 미니학습</h2><span className="tag">판단·산출 전에 먼저 배웁니다</span></div>
          <div className="stagebody">
            <div className="lead">불만은 <b>상대의 선행 발화에 대한 응답</b>이라, 무엇에 불만을 제기하는지 앞 발화가 먼저 주어집니다.</div>
            <div className="situ">
              <div className="role">거래처 담당자 (상대)</div>
              <div className="utt zh">这批货因为工厂那边的原因，可能要再推迟一周发出，请您谅解。</div>
              <div className="utt" style={{ color: "var(--faint)", fontSize: 12, marginTop: 4 }}>(공장 사정으로 이번 물량 발송이 한 주 더 늦어질 수 있으니 양해 부탁드립니다.)</div>
            </div>
            <div className="arrowdown">↓ 이 통보에 대해 불만을 제기하고 대응을 요구해야 하는 상황</div>
            <div className="src">
              <div className="lbl">번역할 원문 (한국어)</div>
              <div className="ko">"지난번에도 일정이 밀렸는데 이번에 또 지연되면 저희 쪽 납품에 차질이 생깁니다. 늦어도 예정일까지는 맞춰 주셔야 할 것 같습니다."</div>
            </div>
            <div className="mini" style={{ marginTop: 12 }}>
              <div className="minicard"><div className="mt">화용 포인트</div><div className="md">불만은 <b>정당한 문제 제기</b>를 하면서도 <b>관계를 끊지 않는</b> 것이 관건. 너무 세면 거래 관계가 상하고, 너무 약하면 요구가 전달되지 않습니다.</div></div>
              <div className="minicard"><div className="mt">왜 어려운가</div><div className="md">감정을 그대로 옮기면 <b>비난</b>이 됩니다. "당신 탓"이 아니라 <b>"결과·영향"</b> 중심으로, 요구는 분명하되 표현은 완곡하게.</div></div>
              <div className="minicard"><div className="mt">한·중 차이</div><div className="md">한국어는 "~해 주셔야 할 것 같습니다"로 완곡하게 압박하지만, 중국어는 <span className="zh">希望 / 还是 / 尽量</span> 등으로 <b>여지를 남기며</b> 요구합니다.</div></div>
              <div className="minicard"><div className="mt">맛보기 표현</div><div className="md"><span className="zh">难免会影响…</span>(영향이 불가피하다) · <span className="zh">希望贵公司能…</span>(~해 주시길 바랍니다) — 비난 대신 영향·바람으로.</div></div>
            </div>
            <div className="notew">미니학습은 한 화면 분량으로 원리만 노출합니다. 핵심 표현 전체는 3단계에서 공개됩니다(앞 화면 보고 답 고르기 방지).</div>
          </div>
        </div>

        {/* 2 */}
        <div className="stage">
          <div className="stagehead"><span className="sn">2</span><h2>적절성 판단</h2><span className="tag">중급: 후보 5개 · 등급 평가 후 제출</span></div>
          <div className="stagebody">
            <div className="lead">같은 뜻을 <b>직접 ↔ 완곡</b>으로 실현한 AI 번역 후보 5개입니다. 각 후보가 이 상황(공적·대등·중간 부담)에 <b>적절한지 등급으로 평가</b>하세요. 정답을 고르는 게 아니라, 각 표현의 화용 리스크를 판단하는 훈련입니다.</div>
            <div className="cands">
              <div className="cand bad">
                <div className="dlv">직접성<span className="num">5</span>매우 직접</div>
                <div className="body">
                  <div className="zh">你们必须在原定日期前发货，不能再拖了。</div>
                  <div className="flabel bad">과직접 · directness / imposition</div>
                </div>
              </div>
              <div className="cand">
                <div className="dlv">직접성<span className="num">4</span></div>
                <div className="body">
                  <div className="zh">这次请一定按原定日期发货，否则会影响我们的交付。</div>
                  <div className="rate"><span className="rbtn">부적절</span><span className="rbtn">애매</span><span className="rbtn">적절</span></div>
                </div>
              </div>
              <div className="cand answer">
                <div className="dlv">직접성<span className="num">3</span>적정대</div>
                <div className="body">
                  <div className="zh">这样的话难免会影响我们的交付，希望贵公司这次尽量按原定日期发货。</div>
                  <div className="badge">✓ 이 상황의 적정 후보</div>
                  <div className="flabel ok">적정 · 문제 제기 + 관계 유지</div>
                </div>
              </div>
              <div className="cand">
                <div className="dlv">직접성<span className="num">2</span></div>
                <div className="body">
                  <div className="zh">如果方便的话，是不是可以尽量按原来的日期发货呢？</div>
                  <div className="rate"><span className="rbtn">부적절</span><span className="rbtn">애매</span><span className="rbtn">적절</span></div>
                </div>
              </div>
              <div className="cand bad">
                <div className="dlv">직접성<span className="num">1</span>매우 완곡</div>
                <div className="body">
                  <div className="zh">我们完全理解贵公司的难处，延期也没关系，一切以贵公司方便为准。</div>
                  <div className="flabel bad">과우회 · 요구가 사라짐(의미 이탈)</div>
                </div>
              </div>
            </div>
            <div className="notew">중급은 후보 5개(고급 7 · 초급 3). 부적절 후보는 <b>직접 수정</b>도 함께 제출합니다(중급 = 판단 30 · 수정 30 · 산출 40).</div>
          </div>
        </div>

        {/* 3 */}
        <div className="stage">
          <div className="stagehead"><span className="sn">3</span><h2>화용 설명</h2><span className="tag">제출 후 공개 · 표현 요소 단위로</span></div>
          <div className="stagebody">
            <div className="lead">왜 3번이 적정하고 5번·1번이 부적절한지, <b>어느 표현이 어느 지점을 건드리는지</b> 요소 단위로 짚어드립니다.</div>
            <div className="explain">
              <div className="exrow"><div className="eh">직접성(directness) — 요구는 하되 명령은 피하기</div><div className="ed">5번 <span className="el">必须</span><span className="el">不能再拖</span>는 상대를 <b>지시·질책</b>하는 명령조라, 대등한 거래 관계에서 반감을 부릅니다. 3번은 <span className="el">希望</span><span className="el">尽量</span>으로 <b>요구를 유지하면서 강도를 낮췄습니다</b>.</div></div>
              <div className="exrow"><div className="eh">부담 관리(imposition) — 비난이 아니라 영향으로</div><div className="ed"><span className="el">难免会影响我们的交付</span>는 "당신 탓"이 아니라 <b>결과·영향</b>을 진술합니다. 상대 체면을 덜 손상시키면서 문제의 심각성은 전달됩니다.</div></div>
              <div className="exrow"><div className="eh">의미 보존 — 완곡해도 요구는 남아야</div><div className="ed">1번은 지나치게 물러서 <span className="el">延期也没关系</span>로 <b>원문에 없는 수용</b>을 만들어, 불만·요구라는 원문의 핵심 의도가 사라졌습니다. 완곡함이 <b>의미 이탈</b>이 된 경우입니다.</div></div>
              <div className="exrow l1"><div className="eh">한·중 대조 (L1 transfer)</div><div className="ed">한국어 "맞춰 주셔야 할 것 같습니다"의 완곡한 압박을 그대로 직역하면 중국어에선 어색하거나 오히려 약해집니다. 중국어는 <span className="el">希望贵公司能…</span> 구문으로 <b>바람+격식</b>을 실어 같은 압박을 자연스럽게 만듭니다.</div></div>
            </div>
          </div>
        </div>

        {/* 4 */}
        <div className="stage">
          <div className="stagehead"><span className="sn">4</span><h2>직접 산출</h2><span className="tag">선택이 아니라 직접 번역</span></div>
          <div className="stagebody">
            <div className="lead">이제 후보를 고르는 게 아니라, <b>학습자가 직접 번역문을 작성</b>합니다. 앞에서 판단한 것과 <b>다른 상황</b>이 주어집니다(배운 걸 베끼지 않도록).</div>
            <div className="produce">
              <div className="task"><b>산출 과제:</b> 아래 한국어 불만을, 거래처와의 관계를 유지하면서 중국어 업무 이메일 문장으로 옮기세요.<br /><span style={{ color: "var(--muted)", fontSize: 12 }}>"이번 달 청구서 금액이 계약서와 다르게 청구되어 있습니다. 확인 후 수정된 청구서를 다시 보내 주시기 바랍니다."</span></div>
              <div className="inputbox"><span className="typed">这个月的账单金额与合同上的不一致，希望贵公司核对后，重新发一份修改好的账单给我们。</span> <span style={{ color: "var(--faint)" }}>|</span></div>
              <div className="hintline">필요하면 <span className="hbtn">핵심 표현 힌트</span> · <span className="hbtn">한·중 대조 힌트</span> (중급은 요청 시에만 제공)</div>
              <div className="model">
                <div className="mh">제출 후: 모범답안 대조</div>
                <div className="mb">本月账单金额与合同约定不符，烦请贵公司核实后重新提供一份更正后的账单。</div>
              </div>
              <div className="notew">제출 전에는 모범답안이 보이지 않습니다. 산출 → 제출 → 대조·피드백 순서로, "고르기"가 아니라 "만들기"를 훈련합니다.</div>
            </div>
          </div>
        </div>

        {/* 5 */}
        <div className="stage">
          <div className="stagehead"><span className="sn">5</span><h2>수행 리포트</h2><span className="tag">약점 진단 + 다음 학습</span></div>
          <div className="stagebody">
            <div className="lead">이번 수행을 <b>rubric 3축</b>으로 평가하고, 어느 화용 지점에서 약했는지 정리합니다. 이 기록이 쌓여 개인 성장 추이가 됩니다.</div>
            <div className="rubric">
              <div className="rcard"><div className="rn">의미·의도 보존</div><div className="bar"><span style={{ width: "88%", background: "var(--ok)" }} /></div><div className="rv">원문의 요구·정보를 잘 보존</div></div>
              <div className="rcard"><div className="rn">관계·상황 적절성</div><div className="bar"><span style={{ width: "62%", background: "var(--warn)" }} /></div><div className="rv">요구는 전달됐으나 완화 표현 부족</div></div>
              <div className="rcard"><div className="rn">목표어 실현도</div><div className="bar"><span style={{ width: "80%", background: "var(--ok)" }} /></div><div className="rv">문법·격식 자연스러움</div></div>
            </div>
            <div className="weak">
              <div className="wt">이번에 약했던 지점 (failed_challenge)</div>
              <ul>
                <li><b>imposition(부담 관리)</b> — "希望…重新发" 대신 "烦请…核实后重新提供"처럼 완곡·격식 표현을 쓰면 부담이 더 완화됩니다.</li>
                <li>불만·요구 화행에서 <b>비난 어조</b>보다 <b>영향 진술</b> 중심으로 가는 연습이 더 필요합니다.</li>
              </ul>
            </div>
            <div className="notew">누적 기록: 최근 3회 불만·거절(고부담) 화행에서 imposition 축 약세 → 다음 추천 시나리오는 imposition 완화 집중 과제.</div>
            <span className="nextbtn">다음 추천 학습 시작하기 →</span>
          </div>
        </div>

        <div className="divider-note">
          <b>이 예시가 보여주는 것 —</b> 지금 학습 화면(AI 후보를 고르고 다듬는 방식)과 달리, 목표 워크플로우는 <b>① 먼저 배우고 → ② 판단하고 → ③ 이유를 듣고 → ④ 직접 산출하고 → ⑤ 약점을 진단</b>하는 흐름입니다. 특히 ④는 "선택"이 아니라 "직접 번역 생성"이며, ①·②·④는 서로 다른 상황을 써서 앞 화면을 베끼지 못하게 합니다.
        </div>

        <div className="footer">
          예시 시나리오·중국어 표현은 설계 시연용이며, 실제 서비스 전 <b>원어민 검수</b>를 거칩니다. · 학습자 수준(중급/HSK5)은 후보 수·산출 형태·비계량만 조절하며 흐름은 전 수준 공통입니다. · 화면의 이론 용어(directness·imposition 등)는 관리자·설명용이며, 실제 학습자 화면에는 자연어로 표시됩니다.
        </div>
      </div>
    </div>
  );
};

export default WorkflowPreview;
