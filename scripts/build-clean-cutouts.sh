#!/bin/sh

set -eu

source_dir="public/wardrobe/cutouts"
output_dir="public/wardrobe/clean"

mkdir -p "$output_dir"

for input in "$source_dir"/*.webp; do
  filename=$(basename "$input")
  width=$(magick identify -format '%w' "$input")
  radius=5

  if [ "$width" -ge 1000 ]; then
    radius=4
  fi

  magick "$input" \
    -channel A -morphology Erode "Disk:$radius" +channel \
    -quality 88 \
    "$output_dir/$filename"
done

echo "Built clean canvas cutouts in $output_dir"
