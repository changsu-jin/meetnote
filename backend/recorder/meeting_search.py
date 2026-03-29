"""Meeting search via TF-IDF + LLM RAG.

Indexes meeting notes and answers natural language queries
by finding relevant meetings and passing them to Claude/Ollama.
No external dependencies beyond what's already installed.
"""

from __future__ import annotations

import logging
import math
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search result."""
    filename: str
    score: float
    snippet: str  # first ~200 chars of matching content


@dataclass
class RAGResult:
    """Result of a RAG query."""
    answer: str
    sources: list[SearchResult]
    success: bool
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Simple TF-IDF implementation (no sklearn dependency)
# ---------------------------------------------------------------------------

# Korean + English tokenizer: split on non-word characters, filter short tokens
_TOKEN_RE = re.compile(r"[\w가-힣]+", re.UNICODE)
_STOP_WORDS = {
    "이", "그", "저", "것", "수", "등", "더", "중", "때", "좀",
    "및", "의", "를", "을", "에", "가", "는", "은", "로", "와", "과",
    "도", "한", "인", "된", "하", "해", "되", "있", "없",
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "and", "or", "not", "this", "that", "it", "as",
}


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase words, removing stop words."""
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if len(t) > 1 and t not in _STOP_WORDS]


class MeetingIndex:
    """In-memory TF-IDF index for meeting notes."""

    def __init__(self) -> None:
        self._docs: dict[str, str] = {}  # filename -> content
        self._tf: dict[str, Counter] = {}  # filename -> term frequencies
        self._df: Counter = Counter()  # document frequency per term
        self._doc_count: int = 0

    def clear(self) -> None:
        self._docs.clear()
        self._tf.clear()
        self._df.clear()
        self._doc_count = 0

    def add_document(self, filename: str, content: str) -> None:
        """Add or update a document in the index."""
        # Remove old version if exists
        if filename in self._docs:
            old_terms = set(self._tf[filename].keys())
            for term in old_terms:
                self._df[term] -= 1
            self._doc_count -= 1

        tokens = _tokenize(content)
        tf = Counter(tokens)

        self._docs[filename] = content
        self._tf[filename] = tf
        self._doc_count += 1

        for term in set(tokens):
            self._df[term] += 1

    @property
    def doc_count(self) -> int:
        return self._doc_count

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        """Search for documents matching the query using TF-IDF cosine similarity."""
        if self._doc_count == 0:
            return []

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        query_tf = Counter(query_tokens)

        # Compute TF-IDF for query
        query_vec: dict[str, float] = {}
        for term, count in query_tf.items():
            df = self._df.get(term, 0)
            if df == 0:
                continue
            idf = math.log(self._doc_count / df)
            query_vec[term] = count * idf

        if not query_vec:
            return []

        # Score each document
        scores: list[tuple[str, float]] = []
        query_norm = math.sqrt(sum(v * v for v in query_vec.values()))

        for filename, doc_tf in self._tf.items():
            dot_product = 0.0
            doc_norm_sq = 0.0

            for term, count in doc_tf.items():
                df = self._df.get(term, 1)
                idf = math.log(self._doc_count / df)
                tfidf = count * idf
                doc_norm_sq += tfidf * tfidf

                if term in query_vec:
                    dot_product += query_vec[term] * tfidf

            if dot_product > 0 and doc_norm_sq > 0:
                doc_norm = math.sqrt(doc_norm_sq)
                similarity = dot_product / (query_norm * doc_norm)
                scores.append((filename, similarity))

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        for filename, score in scores[:top_k]:
            content = self._docs[filename]
            snippet = content[:300].replace("\n", " ").strip()
            if len(content) > 300:
                snippet += "..."
            results.append(SearchResult(filename=filename, score=score, snippet=snippet))

        return results


class MeetingSearcher:
    """RAG-based meeting search using TF-IDF + LLM."""

    def __init__(self) -> None:
        self._index = MeetingIndex()

    @property
    def index(self) -> MeetingIndex:
        return self._index

    def update_index(self, meetings: dict[str, str]) -> int:
        """Rebuild index from a dict of filename -> content.

        Returns the number of documents indexed.
        """
        self._index.clear()
        for filename, content in meetings.items():
            self._index.add_document(filename, content)
        logger.info("Meeting index rebuilt: %d documents.", self._index.doc_count)
        return self._index.doc_count

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        """Search meetings by keyword relevance."""
        return self._index.search(query, top_k)

    def query(self, question: str, top_k: int = 3, timeout: int = 120) -> RAGResult:
        """Answer a question using RAG (retrieve + generate).

        Retrieves relevant meetings, then uses Claude/Ollama to answer.
        """
        # 1. Retrieve
        results = self.search(question, top_k=top_k)
        if not results:
            return RAGResult(
                answer="관련 회의록을 찾을 수 없습니다.",
                sources=[],
                success=True,
            )

        # 2. Build context
        context_parts = []
        for r in results:
            content = self._index._docs.get(r.filename, "")
            # Limit each document to 5000 chars
            truncated = content[:5000]
            context_parts.append(f"--- {r.filename} ---\n{truncated}")

        context = "\n\n".join(context_parts)

        prompt = f"""\
다음은 과거 회의록에서 검색된 관련 내용입니다. 이 내용을 바탕으로 질문에 답변해주세요.

## 관련 회의록

{context}

## 질문

{question}

## 규칙
- 회의록에 명시된 내용만 기반으로 답변하세요.
- 출처 회의록 파일명을 답변에 포함하세요.
- 관련 내용이 없으면 "해당 내용을 찾을 수 없습니다"라고 답하세요.
"""

        # 3. Generate answer via Claude or Ollama
        answer = self._generate(prompt, timeout)
        if answer is None:
            return RAGResult(
                answer="LLM 엔진을 사용할 수 없습니다. Claude CLI 또는 Ollama를 설치해주세요.",
                sources=results,
                success=False,
                error="No LLM engine available",
            )

        return RAGResult(answer=answer, sources=results, success=True)

    def _generate(self, prompt: str, timeout: int = 120) -> Optional[str]:
        """Try Claude CLI first, then Ollama."""
        import shutil

        # Try Claude
        if shutil.which("claude"):
            try:
                result = subprocess.run(
                    ["claude", "-p", prompt],
                    capture_output=True, text=True, timeout=timeout,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
            except (subprocess.TimeoutExpired, OSError):
                pass

        # Try Ollama
        if shutil.which("ollama"):
            try:
                result = subprocess.run(
                    ["ollama", "run", "llama3.1:8b", prompt],
                    capture_output=True, text=True, timeout=timeout,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
            except (subprocess.TimeoutExpired, OSError):
                pass

        return None
