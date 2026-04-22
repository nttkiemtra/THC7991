import sys
import json
import re

def normalize_exam(data):
    # FIX header
    if "header" not in data:
        data["header"] = {"left": [], "center": []}

    # FIX sections
    for sec in data.get("sections", []):
        
        # FIX type
        sec["type"] = sec.get("type", "multiple_choice")

        # FIX questions
        for q in sec.get("questions", []):

            # FIX id
            if "id" not in q:
                q["id"] = q.get("number", 0)

            # FIX question text
            if "question" not in q:
                q["question"] = q.get("content", "")

            # FIX multiple choice
            if sec["type"] == "multiple_choice":
                q["options"] = q.get("options", [])
                q["answer"] = str(q.get("answer", ""))[:1]  # lấy A/B/C/D

            # FIX true/false
            if sec["type"] == "true_false":
                if "statements" not in q:
                    q["statements"] = [
                        {"text": opt, "answer": False}
                        for opt in q.get("options", [])
                    ]

    return data

def fix_json(text):
    """
    Attempts to normalize and fix common JSON errors from LLM outputs.
    """
    # 1. Extract JSON from markdown code blocks if present
    match = re.search(r'```(?:json)?\n?(.*?)```', text, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1)
        
    text = text.strip()
    
    # 2. Fix trailing commas (e.g. "key": "value", } -> "key": "value" })
    text = re.sub(r',\s*([\]\}])', r'\1', text)
    
    # 3. Attempt to parse
    try:
        data = json.loads(text)
        data = normalize_exam(data) # Apply semantic normalization
        return json.dumps(data) # Return minified, valid JSON string
    except json.JSONDecodeError as e:
        # We could add more aggressive fixes here (like auto-closing brackets)
        # but for now, we return empty to signal failure.
        return ""

if __name__ == '__main__':
    # Read from stdin to handle large payloads safely
    raw_text = sys.stdin.read()
    
    result = fix_json(raw_text)
    if result:
        print(result)
        sys.exit(0)
    else:
        sys.exit(1)
