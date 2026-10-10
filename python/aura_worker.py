"""Local retrieval and acoustic diagnostics. No network, credentials, or file access."""
import sys
import json
import math
import re
from collections import Counter


def rank(query, items, limit=8):
    documents = [Counter(re.findall(r"\w+", s.lower())) for s in items]
    q = Counter(re.findall(r"\w+", query.lower()))
    vocab = set(q).union(*(set(d) for d in documents))
    idf = {w: math.log((1 + len(documents)) / (1 + sum(w in d for d in documents))) + 1 for w in vocab}
    def vector(counts):
        v = {w: (1 + math.log(n)) * idf[w] for w, n in counts.items()}
        norm = math.sqrt(sum(n * n for n in v.values())) or 1
        return {w: n / norm for w, n in v.items()}
    qv = vector(q)
    scored = [(sum(qv.get(w, 0) * n for w, n in vector(d).items()), i) for i, d in enumerate(documents)]
    return [items[i] for _, i in sorted(scored, key=lambda pair: (-pair[0], pair[1]))[:limit]]


def dispatch(data):
    if data.get("operation") == "health":
        return {"available": True, "engine": "Python TF-IDF + acoustic statistics", "version": sys.version.split()[0]}
    if data.get("operation") == "rank":
        items = data.get("items", [])[:200]
        if not all(isinstance(s, str) and len(s) <= 500 for s in items):
            raise ValueError("Invalid memory items")
        return {"items": rank(str(data.get("query", ""))[:1500], items), "method": "Python TF-IDF cosine retrieval"}
    if data.get("operation") == "audio":
        frames = data.get("frames", [])[:2400]
        if not frames or any(not isinstance(x, (int, float)) or not math.isfinite(x) or x < 0 or x > 1 for x in frames):
            raise ValueError("Invalid audio features")
        return {"peak": max(frames), "mean": sum(frames) / len(frames), "audible": sum(x > .012 for x in frames) >= 4,
                "method": "Local acoustic energy; not neural speech recognition"}
    raise ValueError("Unsupported operation")


if __name__ == "__main__":
    try:
        data = json.loads(sys.stdin.read(250000))
        print(json.dumps({"ok": True, "data": dispatch(data)}))
    except Exception:
        print(json.dumps({"ok": False, "error": "Local analysis failed"}))
        sys.exit(1)
