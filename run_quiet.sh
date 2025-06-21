#!/bin/bash
# Run Face Controls with all output suppressed

export PYGAME_HIDE_SUPPORT_PROMPT=1
export TF_CPP_MIN_LOG_LEVEL=3
export GRPC_VERBOSITY=ERROR
export GLOG_minloglevel=3

# Run with stderr redirected to /dev/null to suppress all warnings
python main.py "$@" 2>/dev/null