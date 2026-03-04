#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

# =========================
# CONFIG (edit these)
# =========================
OFFSET=1          # how much to add/subtract to the FIRST number (X in X-Y.ext)
START_NUM=4       # start renaming from this X (inclusive)
END_NUM=""        # max X (inclusive). Use "" or "null" to disable the upper bound.
OPERATION="subtract"   # "add" or "subtract"
DRY_RUN=1         # 1 = print actions only, 0 = actually rename
TARGET_DIR="/root/masters-thesis/frontend/public/images/testing/mountains"
# =========================

cd -- "$TARGET_DIR"

# Validate config
if ! [[ "$OFFSET" =~ ^[0-9]+$ ]] || [[ "$OFFSET" -eq 0 ]]; then
  echo "ERROR: OFFSET must be a positive integer." >&2; exit 1
fi
if ! [[ "$START_NUM" =~ ^[0-9]+$ ]]; then
  echo "ERROR: START_NUM must be an integer." >&2; exit 1
fi
if [[ -n "${END_NUM}" && "${END_NUM,,}" != "null" ]] && ! [[ "$END_NUM" =~ ^[0-9]+$ ]]; then
  echo "ERROR: END_NUM must be an integer, empty, or 'null'." >&2; exit 1
fi
if [[ "$OPERATION" != "add" && "$OPERATION" != "subtract" ]]; then
  echo "ERROR: OPERATION must be 'add' or 'subtract'." >&2; exit 1
fi

# Determine effective END_NUM if not provided
effective_end=""
if [[ -z "${END_NUM}" || "${END_NUM,,}" == "null" ]]; then
  max_x=-1
  for f in [0-9]*-[0-9]*.*; do
    [[ -f "$f" ]] || continue
    if [[ "$f" =~ ^([0-9]+)-([0-9]+)\.(.+)$ ]]; then
      x="${BASH_REMATCH[1]}"
      if (( x >= START_NUM )) && (( x > max_x )); then
        max_x="$x"
      fi
    fi
  done
  if (( max_x < START_NUM )); then
    echo "Nothing to rename (no files with X >= START_NUM)." >&2
    exit 0
  fi
  effective_end="$max_x"
else
  effective_end="$END_NUM"
fi

if (( effective_end < START_NUM )); then
  echo "Nothing to rename (END_NUM < START_NUM)." >&2
  exit 0
fi

# Direction
if [[ "$OPERATION" == "add" ]]; then
  sign=1
  sort_key="nr"
else
  sign=-1
  sort_key="n"
fi

# Phase 1: plan
declare -A src_to_dst
declare -A dst_count
declare -A src_set
records=()

for f in [0-9]*-[0-9]*.*; do
  [[ -f "$f" ]] || continue
  if [[ "$f" =~ ^([0-9]+)-([0-9]+)\.(.+)$ ]]; then
    x="${BASH_REMATCH[1]}"
    y="${BASH_REMATCH[2]}"
    ext="${BASH_REMATCH[3]}"

    if (( x < START_NUM || x > effective_end )); then
      continue
    fi

    new_x=$(( x + sign * OFFSET ))
    if (( new_x < 0 )); then
      echo "ERROR: would create negative X for '$f' -> '${new_x}-${y}.${ext}'" >&2
      exit 1
    fi

    dst="${new_x}-${y}.${ext}"

    src_set["$f"]=1
    src_to_dst["$f"]="$dst"
    dst_count["$dst"]=$(( ${dst_count["$dst"]:-0} + 1 ))
    records+=( "${x}"$'\t'"${f}" )
  fi
done

if (( ${#records[@]} == 0 )); then
  echo "Nothing to rename in the selected range." >&2
  exit 0
fi

# Phase 2: validate
for dst in "${!dst_count[@]}"; do
  if (( dst_count["$dst"] > 1 )); then
    echo "ERROR: multiple sources would map to the same destination: '$dst'" >&2
    exit 1
  fi
done

# If destination exists but is NOT itself a source being moved away, it's a real conflict.
for dst in "${!dst_count[@]}"; do
  if [[ -e "$dst" && -z "${src_set[$dst]+x}" ]]; then
    echo "ERROR: destination exists and is not being renamed away: '$dst'" >&2
    exit 1
  fi
done

# Phase 3: execute/print in safe order
# add => highest X first, subtract => lowest X first
while IFS=$'\t' read -r x src; do
  dst="${src_to_dst[$src]}"
  if (( DRY_RUN == 1 )); then
    echo "mv -- '$src' '$dst'"
  else
    mv -- "$src" "$dst"
  fi
done < <(printf '%s\n' "${records[@]}" | sort -t $'\t' -k1,1"$sort_key")
