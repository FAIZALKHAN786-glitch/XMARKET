set -u
B=http://127.0.0.1:3000

# This suite WRITES to the store: it creates requirements and bids. It finishes
# by restoring the seeded demo dataset, which is what keeps repeated runs
# repeatable — but it also removes anything you posted or imported yourself.
# Pass --keep (or KEEP_DATA=1) to leave the store alone; the records this run
# created will stay behind.
KEEP=0
for arg in "$@"; do [ "$arg" = "--keep" ] && KEEP=1; done
[ "${KEEP_DATA:-0}" = "1" ] && KEEP=1
pass=0; fail=0
# Smoke test for every API route. Requires a running server:
#   npm run dev      npm run api:smoke
check() { # name expected_code actual_code [body]
  if [ "$2" = "$3" ]; then printf "  PASS  %-46s %s\n" "$1" "$3"; pass=$((pass+1));
  else printf "  FAIL  %-46s got %s want %s\n     %s\n" "$1" "$3" "$2" "${4:-}"; fail=$((fail+1)); fi
}
code() { curl -s -o /tmp/out.json -w "%{http_code}" "$@"; }

# --------------------------------------------------------------- preflight
# The bid-lifecycle, AI and compare checks operate on the demo fixture
# requirement `r_mech` and its offer `bid_mech_atlas`. On an empty store those
# records do not exist, so ten checks would 404 for reasons that have nothing
# to do with the code under test. Say so instead of reporting ten failures.
if [ "$(code "$B/api/requirements/r_mech")" != "200" ]; then
  printf "\n  Cannot reach the demo fixtures this suite asserts against.\n"
  printf "  It needs the sample requirement r_mech, which an empty store lacks.\n\n"
  printf "  Run the server with the sample data and try again:\n\n"
  printf "    XMARKET_SEED=demo npm run dev     # terminal 1\n"
  printf "    npm run api:smoke                 # terminal 2\n\n"
  printf "  (or set XMARKET_SEED=demo in .env.local and restart)\n\n"
  exit 2
fi

if [ "$KEEP" = "1" ]; then
  echo "(running with --keep: the store will not be reset, so this run's test records stay behind)"
else
  echo "(this suite restores the seeded demo dataset at the end — pass --keep to keep your own records)"
fi
echo

echo "--- requirements ---"
c=$(code $B/api/requirements); check "GET list" 200 "$c"
c=$(code "$B/api/requirements?category=software&sort=budget"); check "GET filtered+sorted" 200 "$c"
c=$(code "$B/api/requirements?status=bogus"); check "GET invalid status rejected" 400 "$c"
c=$(code "$B/api/requirements?q=cnc"); check "GET search" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        search hits:',d['meta']['total'])"

c=$(code -X POST $B/api/requirements -H 'content-type: application/json' -d '{
 "title":"Bulk anodised brackets — 2,000 units",
 "summary":"Replacement mounting brackets for the R4 fleet, matte black anodised.",
 "description":"We need 2,000 anodised aluminium brackets to a supplied drawing. Material 6061-T6, type II matte black anodise, dimensional report per batch required.",
 "category":"manufacturing","budgetMax":42000,"budgetTarget":35000,
 "deadline":"2026-12-15","closesAt":"2026-10-25","location":"Austin, TX",
 "tags":["Anodising","Aluminium 6061","CNC"],"mustHaves":["Type II matte black","Dimensional report per batch"]}')
check "POST create" 201 "$c"
RID=$(python3 -c "import json;print(json.load(open('/tmp/out.json'))['data']['requirement']['id'])")
echo "        new requirement: $RID"

c=$(code -X POST $B/api/requirements -H 'content-type: application/json' -d '{"title":"short","summary":"x","description":"y","category":"software","budgetMax":10,"budgetTarget":999999,"deadline":"2026-12-15","closesAt":"2026-10-25","location":"X","tags":["a"],"mustHaves":[]}')
check "POST validation rejected" 400 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'));print('        issues:',[i['path'] for i in d['error']['details']])"

c=$(code -X POST $B/api/requirements -H 'content-type: application/json' -d '{"title":"Budget inversion test case","summary":"Target above the ceiling should fail.","description":"Testing the refined constraint on the input schema.","category":"software","budgetMax":1000,"budgetTarget":5000,"deadline":"2026-12-15","closesAt":"2026-10-25","location":"Remote","tags":["React","Next.js"],"mustHaves":[]}')
check "POST target>ceiling rejected" 400 "$c"

echo "--- bids ---"
c=$(code -X POST $B/api/requirements/$RID/bids -H 'content-type: application/json' -d '{
 "price":38000,"deliveryDays":40,"pitch":"We run two anodising lines and hold the matte black finish to a measured delta-E of 1.2. First article in ten days, per-batch dimensional report, 2,000 units delivered inside your window with buffer.",
 "coversTags":["Anodising","Aluminium 6061","CNC"],"milestones":[{"label":"First article","days":10},{"label":"Batch 1","days":25},{"label":"Completion","days":40}]}')
check "POST bid" 201 "$c"
BID=$(python3 -c "import json;print(json.load(open('/tmp/out.json'))['data']['bid']['id'])")
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        engine score:',d['score']['total'],d['score']['grade'])"
echo "        new bid: $BID"

c=$(code -X POST $B/api/requirements/$RID/bids -H 'content-type: application/json' -d '{"price":99000,"deliveryDays":10,"pitch":"This offer deliberately exceeds the buyers hard ceiling so the commercial guard rail should reject it before it touches the database at all.","coversTags":["CNC"],"milestones":[]}')
check "POST over-ceiling rejected" 422 "$c"
python3 -c "import json;print('       ',json.load(open('/tmp/out.json'))['error']['message'])"

c=$(code -X POST $B/api/requirements/$RID/bids -H 'content-type: application/json' -d '{"price":30000,"deliveryDays":400,"pitch":"This offer deliberately promises delivery far beyond the buyers deadline so the schedule guard rail should reject it before it is stored anywhere.","coversTags":["CNC"],"milestones":[]}')
check "POST late-delivery rejected" 422 "$c"

c=$(code -X POST $B/api/requirements/$RID/bids -H 'content-type: application/json' -d '{"price":30000,"deliveryDays":30,"pitch":"Duplicate offer from the same provider should be blocked by the one-live-offer rule on this requirement.","coversTags":["CNC"],"milestones":[]}')
check "POST duplicate bid rejected" 409 "$c"

c=$(code "$B/api/requirements/$RID/bids?wBudget=0.6&wTimeline=0.2&wRelevance=0.2"); check "GET ranked bids" 200 "$c"

echo "--- compare + stats ---"
c=$(code "$B/api/requirements/$RID/compare?wBudget=0.2&wTimeline=0.3&wRelevance=0.5"); check "GET compare matrix" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        benchmark:',d['benchmarks'])"
c=$(code "$B/api/requirements/does-not-exist/compare"); check "GET compare 404" 404 "$c"
c=$(code "$B/api/stats?role=buyer"); check "GET stats buyer" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        buyer totals:',d['totals'])"
c=$(code "$B/api/stats?role=provider"); check "GET stats provider" 200 "$c"
c=$(code "$B/api/providers?category=electronics"); check "GET providers filtered" 200 "$c"
c=$(code "$B/api/events?limit=5"); check "GET events" 200 "$c"
c=$(code "$B/api/bids?status=accepted"); check "GET bids by status" 200 "$c"

echo "--- bid lifecycle ---"
c=$(code -X PATCH $B/api/bids/$BID -H 'content-type: application/json' -d '{"status":"shortlisted"}'); check "PATCH shortlist" 200 "$c"
c=$(code -X PATCH $B/api/bids/$BID -H 'content-type: application/json' -d '{"status":"accepted"}'); check "PATCH accept" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('       ',d['message'])"
c=$(code "$B/api/requirements/$RID"); check "requirement now awarded" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        status:',d['requirement']['status'],'| offers:',len(d['bids']))"
c=$(code -X POST $B/api/requirements/$RID/bids -H 'content-type: application/json' -d '{"price":30000,"deliveryDays":30,"pitch":"Awarded requirements must not accept further offers, this request should be refused outright.","coversTags":["CNC"],"milestones":[]}')
check "POST bid on awarded rejected" 409 "$c"
c=$(code -X PATCH $B/api/bids/nope -H 'content-type: application/json' -d '{"status":"accepted"}'); check "PATCH unknown bid 404" 404 "$c"

echo
echo "--- ai endpoints ---"
c=$(code "$B/api/ai/status"); check "GET ai status" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        provider:',d['provider'],'| model:',d['model'],'| live:',d['live'],'| capabilities:',len(d['capabilities']))"

c=$(code -X POST $B/api/ai/parse-requirement -H 'content-type: application/json' -d '{"brief":"We need 2,000 ABS enclosures, RoHS compliant, tooling included. Budget is around $9,000, absolute ceiling $12,000. We need first articles inside three weeks and the full run by 21 days from award. Deliver to Detroit, MI. Injection moulding experience and ISO 9001 required."}')
check "POST ai parse-requirement" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        mode:',d['meta']['mode'],'| category:',d['draft']['category'],'| target:',d['draft']['budgetTarget'],'| ceiling:',d['draft']['budgetMax'],'| days:',d['draft']['deadlineInDays'])"

c=$(code -X POST $B/api/ai/parse-requirement -H 'content-type: application/json' -d '{"brief":"too short"}')
check "POST ai parse too-short rejected" 400 "$c"

c=$(code -X POST $B/api/ai/score-bid -H 'content-type: application/json' -d '{"requirementId":"r_mech","bidId":"bid_mech_atlas"}')
check "POST ai score-bid" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        mode:',d['meta']['mode'],'| score:',d['semantic']['score'],'| confidence:',d['semantic']['confidence'],'| gaps:',len(d['semantic']['gaps']))"

c=$(code -X POST $B/api/ai/score-bid -H 'content-type: application/json' -d '{"requirementId":"r_mech","bidId":"nope"}')
check "POST ai score unknown bid 404" 404 "$c"

c=$(code -X POST $B/api/ai/draft-bid -H 'content-type: application/json' -d '{"requirementId":"r_mech"}')
check "POST ai draft-bid" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        mode:',d['meta']['mode'],'| pitch:',len(d['draft']['pitch']),'chars | milestones:',len(d['draft']['milestones']))"

c=$(code -X POST $B/api/ai/summarize -H 'content-type: application/json' -d '{"requirementId":"r_mech"}')
check "POST ai summarize" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        mode:',d['meta']['mode'],'| offers:',d['offerCount'],'| tradeoffs:',len(d['summary']['tradeoffs']))"

echo
echo "--- importing external records ---"
c=$(code -X POST $B/api/admin/import -H 'content-type: application/json' -d '{
 "dryRun": true,
 "requirements": [{
   "title":"Smoke test imported notice","summary":"A synthetic notice used to verify the import path end to end.",
   "description":"Synthetic description long enough to pass validation. It exists only in the test suite.",
   "category":"software","buyerName":"Smoke Test Borough Council",
   "budgetMax":50000,"budgetTarget":42000,
   "deadline":"2026-12-01","closesAt":"2026-11-20","location":"Testville",
   "tags":["Testing","Fixture"],"mustHaves":[],
   "source":{"name":"Smoke fixture","url":"https://example.org/notice/1","ref":"SMOKE-1","importedAt":"2026-10-04T00:00:00.000Z"}
 }]}')
check "POST import dry run" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        would import:',d['total'],'| new buyers:',d['buyersCreated'])"

c=$(code -X POST $B/api/admin/import -H 'content-type: application/json' -d '{
 "requirements": [{
   "title":"Smoke test imported notice","summary":"A synthetic notice used to verify the import path end to end.",
   "description":"Synthetic description long enough to pass validation. It exists only in the test suite.",
   "category":"software","buyerName":"Smoke Test Borough Council",
   "budgetMax":50000,"budgetTarget":42000,
   "deadline":"2026-12-01","closesAt":"2026-11-20","location":"Testville",
   "tags":["Testing","Fixture"],"mustHaves":[],
   "source":{"name":"Smoke fixture","url":"https://example.org/notice/1","ref":"SMOKE-1","importedAt":"2026-10-04T00:00:00.000Z"}
 }]}')
check "POST import" 201 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        imported:',d['imported'],'| buyers created:',d['buyersCreated'])"

c=$(code -X POST $B/api/admin/import -H 'content-type: application/json' -d '{
 "requirements": [{
   "title":"Smoke test imported notice","summary":"A synthetic notice used to verify the import path end to end.",
   "description":"Synthetic description long enough to pass validation. It exists only in the test suite.",
   "category":"software","buyerName":"Smoke Test Borough Council",
   "budgetMax":50000,"budgetTarget":42000,
   "deadline":"2026-12-01","closesAt":"2026-11-20","location":"Testville",
   "tags":["Testing","Fixture"],"mustHaves":[],
   "source":{"name":"Smoke fixture","url":"https://example.org/notice/1","ref":"SMOKE-1","importedAt":"2026-10-04T00:00:00.000Z"}
 }]}')
check "POST import is idempotent" 201 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];assert d['imported']==0,'re-import must not duplicate';print('        re-imported:',d['imported'],'| skipped:',len(d['skipped']),'—',d['skipped'][0]['reason'])"

c=$(code -X POST $B/api/admin/import -H 'content-type: application/json' -d '{"requirements":[{"title":"bad"}]}')
check "POST import validation rejected" 400 "$c"

c=$(code "$B/api/requirements?q=Smoke%20test%20imported")
check "imported record is listed" 200 "$c"
python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];r=d['requirements'][0];print('        source:',r['source']['name'],'|',r['source']['url'])"

echo
echo "--- semantic blend + cache ---"
c=$(code "$B/api/requirements/r_mech/compare?wSemantic=0.25"); check "GET blended compare" 200 "$c"
python3 -c "import json;m=json.load(open('/tmp/out.json'))['data']['semanticMeta'];print('        semanticMeta:',m and (m['mode']+' | scored '+str(m['scoredBids'])+'/'+str(m['requestedBids'])+' | '+('cached' if m['cached'] else 'fresh')))"

c=$(code "$B/api/requirements/r_mech/compare"); check "GET plain compare has no model calls" 200 "$c"
python3 -c "import json;m=json.load(open('/tmp/out.json'))['data']['semanticMeta'];assert m is None,'plain compare must not call the model';print('        semanticMeta: none (deterministic, as expected)')"

c=$(code -X POST "$B/api/admin/reset?scope=ai-cache"); check "POST purge ai cache" 200 "$c"
python3 -c "import json;print('        dropped entries:',json.load(open('/tmp/out.json'))['data']['droppedCacheEntries'])"

echo
echo "--- cleanup ---"
if [ "$KEEP" = "1" ]; then
  echo "  SKIP  restore demo data (--keep: your records were left untouched)"
else
  c=$(code -X POST "$B/api/admin/reset?scope=all"); check "POST restore demo data" 200 "$c"
  python3 -c "import json;d=json.load(open('/tmp/out.json'))['data'];print('        restored:',d['counts'])"
  echo "        note: any records you posted or imported were removed by this reset"
fi

echo
echo "RESULT: $pass passed, $fail failed"
