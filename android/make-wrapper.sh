#!/usr/bin/env sh
set -eu
if ! command -v gradle >/dev/null 2>&1; then
  echo "Gradle is not installed. Open the android folder in Android Studio, or install Gradle 8.9 first."
  exit 1
fi
gradle wrapper --gradle-version 8.9 --distribution-type bin
