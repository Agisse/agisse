#!/bin/sh
set -eu

# The public package includes its build inputs while the GitHub repo is private.
version=$(node -p "require('./package.json').version")
mkdir -p source
git ls-files -z | tar --null -T - -czf "source/agisse-$version-source.tar.gz"
