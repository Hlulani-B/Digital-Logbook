# ─── Curl Tests for Natural Language Entry Endpoint ─────────────────────────
# Run the project-service first: npm run dev
# Then run this script with your Supabase token:
#   bash curl_tests.sh YOUR_SUPABASE_TOKEN
#
# Or test individual cases:
#   curl -X POST http://localhost:5003/service/natural-language-entry \
#     -H "Content-Type: application/json" \
#     -H "Authorization: Bearer YOUR_TOKEN" \
#     -d '{"text": "i want to wash my clothes today"}'

TOKEN=${1:-"YOUR_SUPABASE_TOKEN_HERE"}
BASE_URL="http://localhost:5003/service/natural-language-entry"

echo "=== Testing Natural Language Entry Endpoint ==="
echo "Using token: ${TOKEN:0:20}..."
echo ""

# Helper function
test_case() {
  local num=$1
  local desc=$2
  local text=$3
  echo "--- Test $num: $desc ---"
  echo "Input: \"$text\""
  curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"text\": \"$text\"}" | jq '.'
  echo ""
  echo ""
}

# ─── Basic Keywords ─────────────────────────────────────────────
test_case 1 "today" "i want to wash my clothes today"
test_case 2 "tomorrow" "submit report tomorrow"
test_case 3 "yesterday" "finished the setup yesterday"
test_case 4 "next week" "team meeting next week"

# ─── Relative Dates ─────────────────────────────────────────────
test_case 5 "in 3 days" "deadline in 3 days"
test_case 6 "in 2 weeks" "review in 2 weeks"
test_case 7 "in 1 day (singular)" "due in 1 day"

# ─── Day Names ──────────────────────────────────────────────────
test_case 8 "monday" "standup on monday"
test_case 9 "next wednesday" "presentation next wednesday"
test_case 10 "friday" "deploy on friday"

# ─── End of Period ──────────────────────────────────────────────
test_case 11 "end of month" "close books end of month"
test_case 12 "end of the week" "wrap up end of the week"

# ─── Explicit Dates ─────────────────────────────────────────────
test_case 13 "august 25" "launch on august 25"
test_case 14 "25 december" "holiday on 25 december"
test_case 15 "sep 15th" "review sep 15th"

# ─── No Date ────────────────────────────────────────────────────
test_case 16 "no date reference" "i need to buy groceries"
test_case 17 "plain text" "just a simple note"

# ─── Misspellings ───────────────────────────────────────────────
test_case 18 "tommorow (misspelled)" "do it tommorow"
test_case 19 "todya (misspelled)" "finish todaay"
test_case 20 "wendsday (misspelled)" "meeting wendsday"
test_case 21 "next weak (misspelled)" "deadline next weak"
test_case 22 "thurday (misspelled)" "submit thurday"

echo "=== All tests complete ==="
