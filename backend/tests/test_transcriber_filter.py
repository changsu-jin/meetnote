"""ADR-006: _filter_repeated_hallucinations 검증 (S48)."""

from recorder.transcriber import Transcriber, TranscriptionSegment


def _seg(start: float, text: str) -> TranscriptionSegment:
    return TranscriptionSegment(start=start, end=start + 30.0, text=text)


def test_filter_drops_third_and_later_repeats():
    segments = [_seg(i * 30.0, "감사합니다.") for i in range(28)]
    filtered = Transcriber._filter_repeated_hallucinations(segments)
    assert len(filtered) == 2, "동일 텍스트 28회 연속 → 앞 2개만 남아야 함"
    assert all(s.text == "감사합니다." for s in filtered)


def test_filter_preserves_alternating_segments():
    segments = [
        _seg(0, "네"),
        _seg(5, "그럼"),
        _seg(10, "네"),
        _seg(15, "알겠습니다"),
    ]
    filtered = Transcriber._filter_repeated_hallucinations(segments)
    assert len(filtered) == 4, "교차 반복은 유지되어야 함"


def test_filter_short_input_untouched():
    segments = [_seg(0, "동일"), _seg(5, "동일")]
    filtered = Transcriber._filter_repeated_hallucinations(segments)
    assert len(filtered) == 2, "2개만 있으면 그대로 유지"


def test_filter_mixed_run_keeps_head():
    segments = [
        _seg(0, "시작"),
        _seg(5, "반복"),
        _seg(10, "반복"),
        _seg(15, "반복"),
        _seg(20, "반복"),
        _seg(25, "끝"),
    ]
    filtered = Transcriber._filter_repeated_hallucinations(segments)
    texts = [s.text for s in filtered]
    assert texts == ["시작", "반복", "반복", "끝"], "연속 반복의 앞 2개만 남고 나머지는 drop"
