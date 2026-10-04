#!/bin/bash
# Prepares Christmas Proposal videos for the web. Run after dropping new
# videos into public/videos/christmas/:  npm run videos
#
# For every video there that hasn't been processed yet:
#   - the original is moved to media-originals/christmas-videos/ (git-ignored)
#   - a web .mp4 is written back (H.264 is just repackaged with no quality
#     loss; HEVC/iPhone video is re-encoded to 720p H.264 so every browser
#     can play it)
#   - a poster image is written to posters/ so the gallery loads fast
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/videos/christmas
SRC=media-originals/christmas-videos
mkdir -p "$SRC" "$OUT/posters"
shopt -s nullglob nocaseglob

for f in "$OUT"/*.{mp4,mov,m4v,webm}; do
  name=$(basename "$f"); base="${name%.*}"; ext="${name##*.}"
  if [[ "$ext" == "mp4" && -f "$OUT/posters/$base.jpg" ]]; then continue; fi

  mv "$f" "$SRC/$name"
  codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$SRC/$name" | tr -d ',\n')
  if [[ "$codec" == "h264" ]]; then
    ffmpeg -nostdin -v error -y -i "$SRC/$name" -map 0:v:0 -map '0:a:0?' -c copy -movflags +faststart "$OUT/$base.mp4"
  else
    ffmpeg -nostdin -v error -y -i "$SRC/$name" -vf "scale=-2:'min(1280,ih)'" -c:v libx264 -preset medium -crf 25 \
      -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "$OUT/$base.mp4"
  fi
  ffmpeg -nostdin -v error -y -ss 1 -i "$OUT/$base.mp4" -frames:v 1 -vf "scale=-2:720" -q:v 4 "$OUT/posters/$base.jpg"
  echo "ready: $base.mp4 ($codec)"
done
echo "done"
