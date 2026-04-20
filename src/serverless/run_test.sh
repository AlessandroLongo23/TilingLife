#!/bin/bash

uv run unit_test.py generate --width 32 --heigh 32 --output tiling-graph.json

uv run tiling_main.py

uv run unit_test.py check --iterations output.json --grid tiling-graph.json