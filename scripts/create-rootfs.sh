#!/bin/bash
# extract-rootfs.sh
# Usage: buildah unshare ./extract-rootfs.sh CONTAINER_ID TARGET_DIRECTORY

CONTAINER_ID=$1
TARGET_DIR=$2

if [ -z "$CONTAINER_ID" ] || [ -z "$TARGET_DIR" ]; then
  echo "Usage: $0 CONTAINER_ID TARGET_DIRECTORY"
  exit 1
fi

mkdir -p "$TARGET_DIR"
MOUNT_PATH=$(buildah mount "$CONTAINER_ID")

ls -la "$MOUNT_PATH"
cp -a "$MOUNT_PATH/." "$TARGET_DIR/"
ls -la "$TARGET_DIR"

buildah umount "$CONTAINER_ID"