"""Real LLM agents for the POPPER-PROOF COURT multi-agent trial."""

from .clients import real_agents_available
from .planner import generate_plan
from .reporter import REPORTER_SYSTEM, build_reporter_context, stream_reporter_reply
from .runner import real_trial_event_stream

__all__ = [
    "real_trial_event_stream",
    "real_agents_available",
    "generate_plan",
    "REPORTER_SYSTEM",
    "build_reporter_context",
    "stream_reporter_reply",
]
