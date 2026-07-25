import json, urllib.request
env={}
for line in open(r"C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.env",encoding="utf-8"):
    if "=" in line and not line.strip().startswith("#"):
        k,v=line.strip().split("=",1); env[k]=v
URL=env["VITE_SUPABASE_URL"]+"/functions/v1/generate-scenario"; KEY=env["VITE_SUPABASE_PUBLISHABLE_KEY"]
# 일부러 결함을 심은 미션: 극단 오답(뻔한 오답) + 장면 미명세
mission={"schema_version":"mission_v2","direction":"ko_zh",
 "unit":{"target_feature":"request_mitigation_optionality","target_feature_version":"1.0","learner_label":"완화와 선택권","closing_ko":"요청은 거절할 여지를 얼마나 남기느냐로 무게가 정해집니다."},
 "mpj_items":[{"id":1,"type":"scale4","axis_feature":"request_mitigation_optionality",
   "situation_ko":"거래처에 결제일 연기를 부탁한다.","relation_ko":"거래처 담당자",
   "pdr":{"p":"equal","d":"acquaintance","r":"high"},
   "source":"결제일을 일주일만 미룰 수 있을까요?","target":"你必须把付款日期往后推一周。",
   "highlights":["必须"],"accepted_scale_codes":["very_inappropriate"],
   "explanation_ko":"명령형이라 부적절합니다.","recommended_example":"付款日期能不能往后推一周？"}],
 "production_task":{"mode":"translation","source_modality":"written","situation_ko":"거래처에 결제일 연기를 부탁한다.",
   "relation_ko":"거래처 담당자","pdr":{"p":"equal","d":"acquaintance","r":"high"},
   "source_text":"결제일을 일주일만 미룰 수 있을까요?","preceding_turn":None,
   "reference_alternatives":[{"text":"付款日期方便往后推一周吗？","note_ko":"완화형"}]}}
body={"action":"quality_check","quality":{"mission_content":mission,"direction":"ko_zh","speech_act":"request",
  "feature":{"code":"request_mitigation_optionality","learner_label":"완화와 선택권",
    "band_codes":["too_direct","within_band","too_indirect"],
    "operational_definition":"요청이 거절·조율의 여지를 얼마나 남기는가."}}}
req=urllib.request.Request(URL,data=json.dumps(body,ensure_ascii=False).encode("utf-8"),
  headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
r=json.loads(urllib.request.urlopen(req,timeout=120).read().decode("utf-8"))
q=r.get("quality_check",{})
print("verdict:",q.get("verdict"),"| model:",q.get("model"))
print("summary:",q.get("summary_ko"))
for f in q.get("findings",[]):
    print(f" - [{f.get('severity')}] {f.get('code')} @ {f.get('where')}\n     {f.get('note_ko')}")
